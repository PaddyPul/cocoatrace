import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { config } from '../../config/env';
import { AppError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { recordSecurityEvent } from '../../services/securityEventService';
import type { AuthenticatedActor } from '../../services/authSessionService';

const origin = new URL(config.webUrl).origin;
const rpID = new URL(origin).hostname;
type Purpose = 'registration' | 'authentication';
interface Key {
  id: string;
  public_key: Buffer;
  counter: string;
  label: string;
}
const denied = () =>
  new AppError('Passkey verification failed. Start again.', 403, 'MFA_VERIFICATION_FAILED');

// Same organization → user → session lock order as identity suspension/session issuance.
async function lockIdentity(client: PoolClient, actor: AuthenticatedActor) {
  const organization = (
    await client.query(
      `SELECT id FROM organizations WHERE id=$1
    AND access_suspended_at IS NULL AND verification_status='verified' FOR SHARE`,
      [actor.organizationId],
    )
  ).rows[0];
  const user = (
    await client.query(
      `SELECT password_hash,mfa_recovery_approved_until FROM users WHERE id=$1 AND organization_id=$2
    AND active AND access_suspended_at IS NULL FOR UPDATE`,
      [actor.id, actor.organizationId],
    )
  ).rows[0] as { password_hash: string; mfa_recovery_approved_until: Date | null } | undefined;
  const session = (
    await client.query(
      `SELECT mfa_verified_at,mfa_credential_id FROM sessions WHERE id=$1 AND user_id=$2
    AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE`,
      [actor.sessionId, actor.id],
    )
  ).rows[0] as { mfa_verified_at: Date | null; mfa_credential_id: string | null } | undefined;
  if (!organization || !user || !session) throw denied();
  return { user, session };
}
async function keys(client: PoolClient, userId: string): Promise<Key[]> {
  return (
    await client.query(
      'SELECT id,public_key,counter,label FROM user_passkeys WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at',
      [userId],
    )
  ).rows as Key[];
}
async function requireFresh(client: PoolClient, actor: AuthenticatedActor) {
  const result = await client.query(
    `SELECT s.id FROM sessions s JOIN user_passkeys k ON k.id=s.mfa_credential_id
    WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>NOW()
    AND k.user_id=s.user_id AND k.revoked_at IS NULL
    AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes' AND s.mfa_verified_at<=NOW()`,
    [actor.sessionId, actor.id],
  );
  if (!result.rows[0])
    throw new AppError('Verify an existing passkey first', 403, 'MFA_STEP_UP_REQUIRED');
}
export async function listKeys(actor: AuthenticatedActor) {
  return inDatabaseTransaction(async (client) => {
    await lockIdentity(client, actor);
    return (await keys(client, actor.id)).map((key) => ({ id: key.id, label: key.label }));
  });
}
export async function options(actor: AuthenticatedActor, purpose: Purpose, password?: string) {
  return inDatabaseTransaction(async (client) => {
    const { user } = await lockIdentity(client, actor);
    const enrolled = await keys(client, actor.id);
    if (purpose === 'registration') {
      if (!password || !(await bcrypt.compare(password, user.password_hash))) throw denied();
      const history = (
        await client.query('SELECT 1 FROM user_passkeys WHERE user_id=$1 LIMIT 1', [actor.id])
      ).rows[0];
      if (
        !enrolled.length &&
        history &&
        (!user.mfa_recovery_approved_until ||
          user.mfa_recovery_approved_until.getTime() <= Date.now())
      ) {
        throw new AppError(
          'Reviewed recovery approval is required before replacing all keys',
          403,
          'MFA_RECOVERY_REQUIRED',
        );
      }
      if (enrolled.length >= 10)
        throw new AppError('At most ten active passkeys are allowed', 409, 'MFA_KEY_LIMIT');
      if (enrolled.length) await requireFresh(client, actor);
    } else if (!enrolled.length)
      throw new AppError('Enroll a passkey first', 409, 'MFA_NOT_ENROLLED');
    const value =
      purpose === 'registration'
        ? await generateRegistrationOptions({
            rpName: 'BetterTrade',
            rpID,
            userID: new Uint8Array(Buffer.from(actor.id)),
            userName: actor.email,
            attestationType: 'none',
            excludeCredentials: enrolled.map((key) => ({ id: key.id })),
            authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
          })
        : await generateAuthenticationOptions({
            rpID,
            allowCredentials: enrolled.map((key) => ({ id: key.id })),
            userVerification: 'required',
          });
    await client.query(
      `INSERT INTO mfa_challenges(session_id,user_id,challenge,purpose,expires_at)
      VALUES($1,$2,$3,$4,NOW()+INTERVAL '5 minutes') ON CONFLICT(session_id) DO UPDATE
      SET challenge=EXCLUDED.challenge,purpose=EXCLUDED.purpose,expires_at=EXCLUDED.expires_at,created_at=NOW()`,
      [actor.sessionId, actor.id, value.challenge, purpose],
    );
    return value;
  });
}
export async function verify(
  actor: AuthenticatedActor,
  purpose: Purpose,
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
  label = 'Passkey',
) {
  const success = await inDatabaseTransaction(async (client) => {
    const { user } = await lockIdentity(client, actor);
    // Consumption commits even after an invalid response: replay and parallel retries cannot reuse it.
    const challenge = (
      await client.query(
        `DELETE FROM mfa_challenges WHERE session_id=$1 AND user_id=$2
      RETURNING challenge,purpose,expires_at`,
        [actor.sessionId, actor.id],
      )
    ).rows[0] as { challenge: string; purpose: Purpose; expires_at: Date } | undefined;
    let verified = false;
    let keyId: string | undefined;
    if (challenge && challenge.purpose === purpose && challenge.expires_at.getTime() > Date.now()) {
      const enrolled = await keys(client, actor.id);
      try {
        if (purpose === 'registration') {
          const history = (
            await client.query('SELECT 1 FROM user_passkeys WHERE user_id=$1 LIMIT 1', [actor.id])
          ).rows[0];
          if (
            !enrolled.length &&
            history &&
            (!user.mfa_recovery_approved_until ||
              user.mfa_recovery_approved_until.getTime() <= Date.now())
          )
            throw denied();
          if (enrolled.length) await requireFresh(client, actor);
          if (enrolled.length >= 10) throw denied();
          const result = await verifyRegistrationResponse({
            response: response as RegistrationResponseJSON,
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
          });
          if (result.verified && result.registrationInfo) {
            const credential = result.registrationInfo.credential;
            await client.query(
              `INSERT INTO user_passkeys(id,user_id,public_key,counter,label) VALUES($1,$2,$3,$4,$5)`,
              [
                credential.id,
                actor.id,
                Buffer.from(credential.publicKey),
                credential.counter,
                label,
              ],
            );
            await client.query('UPDATE users SET mfa_recovery_approved_until=NULL WHERE id=$1', [
              actor.id,
            ]);
            keyId = credential.id;
            verified = true;
          }
        } else {
          const key = enrolled.find((item) => item.id === response.id);
          if (key) {
            const result = await verifyAuthenticationResponse({
              response: response as AuthenticationResponseJSON,
              expectedChallenge: challenge.challenge,
              expectedOrigin: origin,
              expectedRPID: rpID,
              requireUserVerification: true,
              credential: {
                id: key.id,
                publicKey: new Uint8Array(key.public_key),
                counter: Number(key.counter),
              },
            });
            if (result.verified) {
              await client.query('UPDATE user_passkeys SET counter=$2 WHERE id=$1', [
                key.id,
                result.authenticationInfo.newCounter,
              ]);
              keyId = key.id;
              verified = true;
            }
          }
        }
      } catch (error) {
        // Database failures must roll back, not leave PostgreSQL in an aborted transaction.
        if (
          error instanceof Error &&
          'code' in error &&
          typeof error.code === 'string' &&
          /^[0-9A-Z]{5}$/.test(error.code)
        )
          throw error;
        verified = false;
      }
    }
    if (verified && keyId) {
      await client.query(
        'UPDATE sessions SET mfa_verified_at=NOW(),mfa_credential_id=$2 WHERE id=$1',
        [actor.sessionId, keyId],
      );
      await recordAudit(client, actor, `mfa.${purpose}.verified`, 'user', actor.id);
    }
    await recordSecurityEvent(
      {
        eventType: `mfa.${purpose}`,
        success: verified,
        actorUserId: actor.id,
        actorOrganizationId: actor.organizationId,
        sessionId: actor.sessionId,
        reason: verified ? undefined : 'invalid_ceremony',
      },
      client,
    );
    return verified;
  });
  if (!success) throw denied();
}
export async function revokeKey(actor: AuthenticatedActor, id: string) {
  return inDatabaseTransaction(async (client) => {
    const { session } = await lockIdentity(client, actor);
    await requireFresh(client, actor);
    const enrolled = await keys(client, actor.id);
    if (!enrolled.some((key) => key.id === id))
      throw new AppError('Passkey unavailable', 404, 'NOT_FOUND');
    if (enrolled.length < 2 || session.mfa_credential_id === id) {
      throw new AppError(
        'Verify with a different enrolled key before removing this key. Keep at least one key.',
        409,
        'MFA_BACKUP_REQUIRED',
      );
    }
    await client.query('UPDATE user_passkeys SET revoked_at=NOW() WHERE id=$1 AND user_id=$2', [
      id,
      actor.id,
    ]);
    await client.query(
      `UPDATE sessions SET revoked_at=NOW(),revoked_reason='passkey_revoked'
      WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL`,
      [actor.id, actor.sessionId],
    );
    await client.query('DELETE FROM mfa_challenges WHERE user_id=$1', [actor.id]);
    await recordAudit(client, actor, 'mfa.credential.revoke', 'user', actor.id);
  });
}
