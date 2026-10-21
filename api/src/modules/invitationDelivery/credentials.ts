import crypto from 'node:crypto';
import { AppError } from '../../errors';

export type SealedToken = { keyId: string; ciphertext: string };
function keyBytes(key: string | undefined): Buffer {
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new AppError('Invitation delivery key unavailable', 503, 'INVITATION_KEY_UNAVAILABLE');
  return Buffer.from(key, 'hex');
}
export function keyId(key: string | undefined): string {
  return crypto.createHash('sha256').update(keyBytes(key)).digest('hex');
}
const context = (invitationId: string, tokenHash: string, recipientDigest: string) =>
  Buffer.from(
    JSON.stringify(['bettertrade-invitation-token', 1, invitationId, tokenHash, recipientDigest]),
  );
export function sealToken(
  token: string,
  invitationId: string,
  tokenHash: string,
  key?: string,
  recipientDigest = '',
): SealedToken {
  if (crypto.createHash('sha256').update(token).digest('hex') !== tokenHash)
    throw new AppError('Invalid invitation generation', 409, 'INVITATION_GENERATION_MISMATCH');
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(key), nonce);
  cipher.setAAD(context(invitationId, tokenHash, recipientDigest));
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    keyId: keyId(key),
    ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url'),
  };
}
export function openToken(
  sealed: SealedToken,
  invitationId: string,
  tokenHash: string,
  key?: string,
  recipientDigest = '',
): string {
  if (sealed.keyId !== keyId(key))
    throw new AppError('Invitation delivery key unavailable', 503, 'INVITATION_KEY_UNAVAILABLE');
  try {
    const data = Buffer.from(sealed.ciphertext, 'base64url');
    if (data.length < 29) throw new Error('invalid');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(key), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    decipher.setAAD(context(invitationId, tokenHash, recipientDigest));
    const token = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString(
      'utf8',
    );
    if (crypto.createHash('sha256').update(token).digest('hex') !== tokenHash)
      throw new Error('invalid');
    return token;
  } catch {
    throw new AppError(
      'Invitation delivery credential invalid',
      409,
      'INVITATION_CREDENTIAL_INVALID',
    );
  }
}
