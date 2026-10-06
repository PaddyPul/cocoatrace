import type { PoolClient } from 'pg';
import { AppError } from '../../errors';
import { authenticateSession, type AuthenticatedActor } from '../../services/authSessionService';

/** Serialize reviewed lifecycle/recovery decisions before any identity row locks. */
export async function lockAccessDecisions(client: PoolClient): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(731904, 1)');
}

export async function authenticateReviewers(
  tokens: [string, string],
  targetUserId?: string,
): Promise<[AuthenticatedActor, AuthenticatedActor]> {
  const reviewers = await Promise.all(tokens.map((token) => authenticateSession(token)));
  if (
    reviewers.some(
      (actor) =>
        !actor ||
        actor.id === targetUserId ||
        !actor.permissions.includes('*') ||
        !actor.mfa?.fresh,
    ) ||
    reviewers[0]?.id === reviewers[1]?.id
  ) {
    throw new AppError(
      'Two distinct freshly passkey-verified platform reviewers are required',
      403,
      'REVIEWERS_REQUIRED',
    );
  }
  return reviewers as [AuthenticatedActor, AuthenticatedActor];
}

/** Caller has locked reviewer organization/user rows. Hold keys and sessions through commit. */
export async function lockReviewerAssurance(
  client: PoolClient,
  actors: [AuthenticatedActor, AuthenticatedActor],
): Promise<void> {
  for (const actor of [...actors].sort((a, b) => a.id.localeCompare(b.id))) {
    const valid = await client.query(
      `SELECT s.id FROM sessions s
      JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=u.organization_id
      JOIN user_passkeys k ON k.id=s.mfa_credential_id
      WHERE s.id=$1 AND s.user_id=$2 AND u.organization_id=$3
      AND s.revoked_at IS NULL AND s.expires_at>NOW()
      AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes' AND s.mfa_verified_at<=NOW()
      AND k.user_id=u.id AND k.revoked_at IS NULL
      AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL
      AND o.verification_status='verified'
      AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND '*'=ANY(r.permissions)) FOR SHARE OF s,k`,
      [actor.sessionId, actor.id, actor.organizationId],
    );
    if (!valid.rows[0])
      throw new AppError(
        'Reviewer assurance changed; start again',
        403,
        'REVIEWER_ASSURANCE_CHANGED',
      );
  }
}
