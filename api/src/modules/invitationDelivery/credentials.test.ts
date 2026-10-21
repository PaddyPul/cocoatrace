import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sealToken, openToken } from './credentials';
const key = '12'.repeat(32),
  token = 'a-private-invitation-bearer';
const hash = crypto.createHash('sha256').update(token).digest('hex');
describe('recoverable private invitation credentials', () => {
  it('recovers the exact token with a separate authenticated key and fresh nonce', () => {
    const first = sealToken(token, 'invite', hash, key);
    const second = sealToken(token, 'invite', hash, key);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
    expect(first.ciphertext).not.toContain(token);
    expect(openToken(first, 'invite', hash, key)).toBe(token);
  });
  it('binds ciphertext to invitation ID and token generation', () => {
    const sealed = sealToken(token, 'invite', hash, key);
    const bound = sealToken(token, 'invite', hash, key, 'intended-recipient');
    expect(() => openToken(bound, 'invite', hash, key, 'different-recipient')).toThrow(
      'credential invalid',
    );
    expect(() => openToken(sealed, 'another-invite', hash, key)).toThrow('credential invalid');
    expect(() => openToken(sealed, 'invite', '0'.repeat(64), key)).toThrow('credential invalid');
  });
  it('fails closed on ciphertext, nonce and authentication tag tampering', () => {
    const sealed = sealToken(token, 'invite', hash, key);
    for (const index of [0, 12, 28]) {
      const data = Buffer.from(sealed.ciphertext, 'base64url');
      data[index] ^= 1;
      expect(() =>
        openToken({ ...sealed, ciphertext: data.toString('base64url') }, 'invite', hash, key),
      ).toThrow('credential invalid');
    }
    expect(() => openToken({ ...sealed, ciphertext: 'invalid' }, 'invite', hash, key)).toThrow(
      'credential invalid',
    );
  });
  it('does not substitute a session secret, missing key or unrelated rotated key', () => {
    const sealed = sealToken(token, 'invite', hash, key);
    for (const candidate of [undefined, 'short', '34'.repeat(32)])
      expect(() => openToken(sealed, 'invite', hash, candidate)).toThrow('key unavailable');
  });
  it('refuses mismatched input before storing recoverable credentials', () => {
    expect(() => sealToken(token, 'invite', '0'.repeat(64), key)).toThrow(
      'Invalid invitation generation',
    );
  });
});
