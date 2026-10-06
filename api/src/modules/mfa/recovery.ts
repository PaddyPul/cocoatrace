import type { AuthenticatedActor } from '../../services/authSessionService';
import { authenticateSession } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { AppError } from '../../errors';

/** Server-console only. No HTTP reset endpoint, recovery code or email can waive existing MFA. */
export async function approveRecovery(
  targetId: string,
  reviewerTokens: [string, string],
  ticket: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(ticket))
    throw new AppError('Use a review ticket ID without personal data', 400);
  const reviewers = await Promise.all(reviewerTokens.map((token) => authenticateSession(token)));
  if (
    reviewers.some(
      (actor) =>
        !actor || actor.id === targetId || !actor.permissions.includes('*') || !actor.mfa?.fresh,
    ) ||
    reviewers[0]?.id === reviewers[1]?.id
  )
    throw new AppError(
      'Two distinct freshly passkey-verified platform reviewers are required',
      403,
    );
  const actors = reviewers as [AuthenticatedActor, AuthenticatedActor];
  await inDatabaseTransaction(async (client) => {
    const target = (await client.query('SELECT organization_id FROM users WHERE id=$1', [targetId]))
      .rows[0] as { organization_id: string } | undefined;
    if (!target) throw new AppError('Account unavailable', 404);
    // Reviewers and target share deterministic organization/user lock order.
    const orgs = [
      ...new Set([target.organization_id, ...actors.map((actor) => actor.organizationId)]),
    ].sort();
    await client.query(
      'SELECT id FROM organizations WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [orgs],
    );
    const ids = [targetId, ...actors.map((actor) => actor.id)].sort();
    await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
      ids,
    ]);
    for (const actor of actors) {
      const valid = await client.query(
        `SELECT s.id FROM sessions s JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=u.organization_id
        JOIN user_passkeys k ON k.id=s.mfa_credential_id WHERE s.id=$1 AND s.user_id=$2
        AND s.revoked_at IS NULL AND s.expires_at>NOW() AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes'
        AND k.user_id=u.id AND k.revoked_at IS NULL AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL
        AND o.verification_status='verified' AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
          WHERE ur.user_id=u.id AND '*'=ANY(r.permissions)) FOR UPDATE OF s`,
        [actor.sessionId, actor.id],
      );
      if (!valid.rows[0]) throw new AppError('Reviewer assurance changed; start again', 403);
    }
    await client.query(
      'UPDATE user_passkeys SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1',
      [targetId],
    );
    await client.query(
      "UPDATE sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoked_reason='reviewed_mfa_recovery' WHERE user_id=$1",
      [targetId],
    );
    await client.query(
      'UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
      [targetId],
    );
    await client.query('DELETE FROM mfa_challenges WHERE user_id=$1', [targetId]);
    await client.query(
      "UPDATE users SET mfa_recovery_approved_until=NOW()+INTERVAL '30 minutes' WHERE id=$1",
      [targetId],
    );
    await recordAudit(client, actors[0], 'mfa.recovery.approve', 'user', targetId, {
      ticket,
      secondReviewerUserId: actors[1].id,
      windowMinutes: 30,
    });
  });
}
