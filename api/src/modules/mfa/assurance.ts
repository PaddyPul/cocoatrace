import type { PoolClient } from 'pg';
import { PRIVILEGED_PERMISSIONS } from './policy';
import { config } from '../../config/env';
import { AppError } from '../../errors';
export interface AssuranceActor {
  id: string;
  organizationId: string;
  sessionId?: string;
}
/** Re-check live assurance inside the mutation transaction, holding identity/session locks through commit. */
export async function assertMutationAssurance(
  client: PoolClient,
  actor: AssuranceActor,
): Promise<void> {
  const identity = (
    await client.query(
      `SELECT u.id,u.active,u.access_suspended_at,o.access_suspended_at AS org_suspended,
    o.verification_status,EXISTS(SELECT 1 FROM user_passkeys WHERE user_id=u.id) AS history,
    EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id
      AND (r.permissions && $3::text[] OR r.name ~ '(^|_)(admin|certifier|regulator)$')) AS privileged
    FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1 AND o.id=$2 FOR SHARE OF o,u`,
      [actor.id, actor.organizationId, PRIVILEGED_PERMISSIONS],
    )
  ).rows[0] as
    | {
        active: boolean;
        access_suspended_at: Date | null;
        org_suspended: Date | null;
        verification_status: string;
        history: boolean;
        privileged: boolean;
      }
    | undefined;
  if (
    !identity ||
    !identity.active ||
    identity.access_suspended_at ||
    identity.org_suspended ||
    identity.verification_status !== 'verified'
  )
    throw new AppError('Account unavailable', 403, 'FORBIDDEN');
  if (!identity.history && !(config.mfaEnforced && identity.privileged)) return;
  if (!actor.sessionId)
    throw new AppError('Fresh passkey verification required', 403, 'MFA_STEP_UP_REQUIRED');
  const valid = await client.query(
    `SELECT s.id FROM sessions s JOIN user_passkeys k ON k.id=s.mfa_credential_id
    WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>NOW()
    AND k.user_id=s.user_id AND k.revoked_at IS NULL
    AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes' AND s.mfa_verified_at<=NOW() FOR SHARE OF s,k`,
    [actor.sessionId, actor.id],
  );
  if (!valid.rows[0])
    throw new AppError('Fresh passkey verification required', 403, 'MFA_STEP_UP_REQUIRED');
}
