import { z } from 'zod';
import { AppError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { recordSecurityEvent } from '../../services/securityEventService';
import {
  authenticateReviewers,
  lockAccessDecisions,
  lockReviewerAssurance,
} from '../mfa/reviewers';

export const privilegedDecisionSchema = z
  .object({
    kind: z.enum(['users', 'organizations']),
    id: z.string().uuid(),
    action: z.enum(['suspend', 'restore', 'deactivate']),
    ticket: z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/),
    reason: z.string().trim().min(10).max(1000),
    reviewerTokens: z.tuple([z.string().min(1).max(8000), z.string().min(1).max(8000)]),
  })
  .strict()
  .refine((value) => value.kind === 'users' || value.action !== 'deactivate', {
    message: 'Organization deactivation is not supported; use reviewed suspension',
  });
export type PrivilegedDecision = z.infer<typeof privilegedDecisionSchema>;

/** Operator console only: no HTTP route and no delegation of wildcard permission. */
export async function decidePrivilegedAccess(input: unknown) {
  const parsed = privilegedDecisionSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError('Invalid privileged access decision', 400, 'INVALID_ACCESS_DECISION');
  const { kind, id, action, ticket, reason, reviewerTokens } = parsed.data;
  const actors = await authenticateReviewers(reviewerTokens, kind === 'users' ? id : undefined);
  return inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
    const identity =
      kind === 'organizations'
        ? { organization_id: id }
        : ((await client.query('SELECT organization_id FROM users WHERE id=$1', [id])).rows[0] as
            | { organization_id: string }
            | undefined);
    if (!identity) throw new AppError('Account unavailable', 404, 'NOT_FOUND');
    if (kind === 'organizations' && actors.some((actor) => actor.organizationId === id))
      throw new AppError(
        'Reviewers must remain outside the affected organization',
        409,
        'REVIEWER_TARGET_CONFLICT',
      );
    const orgIds = [
      ...new Set([identity.organization_id, ...actors.map((actor) => actor.organizationId)]),
    ].sort();
    await client.query(
      'SELECT id FROM organizations WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [orgIds],
    );
    const userIds = [
      ...new Set([...(kind === 'users' ? [id] : []), ...actors.map((actor) => actor.id)]),
    ].sort();
    await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
      userIds,
    ]);
    await lockReviewerAssurance(client, actors);
    const organization = (
      await client.query('SELECT access_suspended_at FROM organizations WHERE id=$1', [
        identity.organization_id,
      ])
    ).rows[0];
    const target =
      kind === 'organizations'
        ? organization
        : (
            await client.query(
              'SELECT active,access_suspended_at,organization_id FROM users WHERE id=$1',
              [id],
            )
          ).rows[0];
    if (!target) throw new AppError('Account unavailable', 404, 'NOT_FOUND');
    if (kind === 'users' && target.organization_id !== identity.organization_id)
      throw new AppError('Account organization changed; start again', 409, 'TARGET_CHANGED');
    if (kind === 'users' && !target.active && action !== 'deactivate')
      throw new AppError(
        'Deactivated accounts cannot be restored by suspension controls',
        409,
        'ACCOUNT_DEACTIVATED',
      );
    if (kind === 'users' && action === 'restore' && organization.access_suspended_at)
      throw new AppError(
        'Restore organization access before restoring this user',
        409,
        'ORGANIZATION_SUSPENDED',
      );
    const changed =
      action === 'deactivate'
        ? Boolean(target.active)
        : Boolean(target.access_suspended_at) !== (action === 'suspend');
    if (!changed) return { id, action, changed: false, revokedSessions: 0 };
    if (action !== 'restore') {
      const remaining = (
        await client.query(
          `SELECT COUNT(DISTINCT u.id)::integer AS count
        FROM users u JOIN organizations o ON o.id=u.organization_id
        WHERE u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL
        AND o.verification_status='verified'
        AND NOT (${kind === 'users' ? 'u.id' : 'u.organization_id'}=$1)
        AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND '*'=ANY(r.permissions))
        AND EXISTS(SELECT 1 FROM user_passkeys k WHERE k.user_id=u.id AND k.revoked_at IS NULL)`,
          [id],
        )
      ).rows[0];
      if (Number(remaining.count) < 2)
        throw new AppError(
          'Keep two active passkey-enrolled platform administrators',
          409,
          'ADMIN_CONTINUITY_REQUIRED',
        );
    }
    if (action === 'deactivate') {
      await client.query(
        'UPDATE users SET active=FALSE,mfa_recovery_approved_until=NULL WHERE id=$1',
        [id],
      );
    } else {
      const table = kind === 'users' ? 'users' : 'organizations';
      await client.query(
        `UPDATE ${table} SET access_suspended_at=${action === 'suspend' ? 'NOW()' : 'NULL'} WHERE id=$1`,
        [id],
      );
    }
    let revokedSessions = 0,
      revokedInvitations = 0;
    if (action !== 'restore') {
      const scope = kind === 'users' ? 'id' : 'organization_id';
      const revoked = await client.query(
        `UPDATE sessions SET revoked_at=NOW(),revoked_reason=$2
        WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE ${scope}=$1)`,
        [id, `reviewed_access.${action}`],
      );
      revokedSessions = revoked.rowCount || 0;
      const invites = await client.query(
        `UPDATE user_invitations SET revoked_at=NOW()
        WHERE accepted_at IS NULL AND revoked_at IS NULL AND ${kind === 'users' ? 'invited_by_user_id' : 'organization_id'}=$1`,
        [id],
      );
      revokedInvitations = invites.rowCount || 0;
      await client.query(
        `UPDATE password_reset_tokens SET used_at=NOW() WHERE used_at IS NULL
        AND user_id IN (SELECT id FROM users WHERE ${scope}=$1)`,
        [id],
      );
      await client.query(
        `DELETE FROM mfa_challenges WHERE user_id IN (SELECT id FROM users WHERE ${scope}=$1)`,
        [id],
      );
      await client.query(`UPDATE users SET mfa_recovery_approved_until=NULL WHERE ${scope}=$1`, [
        id,
      ]);
      if (action === 'deactivate')
        await client.query(
          'UPDATE user_passkeys SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1',
          [id],
        );
    }
    const auditAction = `access.reviewed.${kind}.${action}`;
    const metadata = {
      ticket,
      reason,
      secondReviewerUserId: actors[1].id,
      previousActive: kind === 'users' ? Boolean(target.active) : null,
      previousSuspended: Boolean(target.access_suspended_at),
      revokedSessions,
      revokedInvitations,
    };
    await recordAudit(
      client,
      actors[0],
      auditAction,
      kind === 'users' ? 'user' : 'organization',
      id,
      metadata,
    );
    await recordSecurityEvent(
      {
        eventType: auditAction,
        success: true,
        actorUserId: actors[0].id,
        actorOrganizationId: actors[0].organizationId,
        sessionId: actors[0].sessionId,
        metadata: { ...metadata, targetId: id },
      },
      client,
    );
    return { id, action, changed: true, revokedSessions };
  });
}
