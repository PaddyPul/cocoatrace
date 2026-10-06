import { authenticateReviewers, lockAccessDecisions, lockReviewerAssurance } from './reviewers';
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
  const actors = await authenticateReviewers(reviewerTokens, targetId);
  await inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
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
    await lockReviewerAssurance(client, actors);
    const targetState = (await client.query('SELECT active FROM users WHERE id=$1', [targetId]))
      .rows[0];
    if (!targetState?.active)
      throw new AppError(
        'Deactivated accounts cannot receive recovery approval',
        409,
        'ACCOUNT_DEACTIVATED',
      );
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
