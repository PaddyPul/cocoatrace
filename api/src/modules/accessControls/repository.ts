import { lockAccessDecisions } from '../mfa/reviewers';
import { assertMutationAssurance } from '../mfa/assurance';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { query } from '../../db';
import { AppError, ConflictError, NotFoundError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { recordSecurityEvent } from '../../services/securityEventService';
import { requirePlatformAdministrator, requireSafeTarget } from './policy';

export async function listAccess(
  actor: AuthenticatedActor,
  kind: 'organizations' | 'users',
  after?: string,
  organizationId?: string,
) {
  requirePlatformAdministrator(actor.permissions);
  if (kind === 'users' && !organizationId)
    throw new AppError('Select an organization first', 400, 'ORGANIZATION_REQUIRED');
  const result =
    kind === 'organizations'
      ? await query(
          `SELECT o.id,o.name,o.access_suspended_at,EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.organization_id=o.id AND '*'=ANY(r.permissions)) AS protected
      FROM organizations o WHERE ($1::uuid IS NULL OR o.id>$1::uuid) ORDER BY o.id LIMIT 51`,
          [after || null],
        )
      : await query(
          `SELECT u.id,u.name,u.email,u.active,u.access_suspended_at,EXISTS(SELECT 1 FROM users member JOIN user_roles ur ON ur.user_id=member.id JOIN roles r ON r.id=ur.role_id WHERE member.organization_id=u.organization_id AND '*'=ANY(r.permissions)) AS protected
      FROM users u WHERE u.organization_id=$2 AND ($1::uuid IS NULL OR u.id>$1::uuid) ORDER BY u.id LIMIT 51`,
          [after || null, organizationId],
        );
  const rows = result.rows.slice(0, 50);
  return { rows, next: result.rows.length > 50 ? (rows[49].id as string) : null };
}

export async function changeAccess(
  actor: AuthenticatedActor,
  kind: 'organizations' | 'users',
  id: string,
  suspended: boolean,
  reason: string,
  passwordHash: string,
) {
  return inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
    await assertMutationAssurance(client, actor);
    const actorRow = (
      await client.query(
        `SELECT u.organization_id,u.password_hash,u.active,u.access_suspended_at,o.access_suspended_at AS org_suspended,o.verification_status,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND '*'=ANY(r.permissions)) AS privileged
      FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1 FOR SHARE OF o,u`,
        [actor.id],
      )
    ).rows[0];
    const session = (
      await client.query(
        'SELECT 1 FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() FOR SHARE',
        [actor.sessionId, actor.id],
      )
    ).rows[0];
    if (
      !actorRow ||
      !session ||
      actorRow.organization_id !== actor.organizationId ||
      !actorRow.active ||
      actorRow.access_suspended_at ||
      actorRow.org_suspended ||
      actorRow.verification_status !== 'verified' ||
      !actorRow.privileged ||
      actorRow.password_hash !== passwordHash
    ) {
      throw new AppError(
        'Administrator authorization changed; sign in again',
        403,
        'ADMIN_AUTHORIZATION_CHANGED',
      );
    }
    const identity =
      kind === 'organizations'
        ? { organization_id: id }
        : (await client.query('SELECT organization_id FROM users WHERE id=$1', [id])).rows[0];
    if (!identity) throw new NotFoundError('Account');
    requireSafeTarget(identity.organization_id === actor.organizationId);
    const organization = (
      await client.query('SELECT * FROM organizations WHERE id=$1 FOR UPDATE', [
        identity.organization_id,
      ])
    ).rows[0];
    if (!organization) throw new NotFoundError('Organization');
    const protectedOrg = (
      await client.query(
        `SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.organization_id=$1 AND '*'=ANY(r.permissions) LIMIT 1`,
        [organization.id],
      )
    ).rows[0];
    // Protect the whole privileged organization, including non-admin members.
    requireSafeTarget(Boolean(protectedOrg));
    const target =
      kind === 'organizations'
        ? organization
        : (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!target) throw new NotFoundError('Account');
    if (kind === 'users' && target.organization_id !== organization.id)
      throw new ConflictError('Account organization changed; reload before deciding');
    if (kind === 'users' && !target.active)
      throw new ConflictError('Inactive accounts require a separate deactivation review');
    if (Boolean(target.access_suspended_at) === suspended)
      return { id, suspended, changed: false, revokedSessions: 0 };
    if (kind === 'users' && !suspended && organization.access_suspended_at)
      throw new ConflictError('Restore organization access before restoring this user');
    // Table names are selected from a closed server-side enum, never request interpolation.
    const table = kind === 'organizations' ? 'organizations' : 'users';
    await client.query(
      `UPDATE ${table} SET access_suspended_at=${suspended ? 'NOW()' : 'NULL'} WHERE id=$1`,
      [id],
    );
    const revoked = suspended
      ? await client.query(
          `UPDATE sessions SET revoked_at=NOW(),revoked_reason=$2
      WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE ${kind === 'organizations' ? 'organization_id' : 'id'}=$1)`,
          [id, `${kind}.suspended`],
        )
      : null;
    const invitations =
      suspended && kind === 'organizations'
        ? await client.query(
            `UPDATE user_invitations SET revoked_at=NOW() WHERE organization_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL`,
            [id],
          )
        : null;
    const action = `access.${kind}.${suspended ? 'suspend' : 'restore'}`;
    const metadata = {
      suspended,
      previousSuspended: Boolean(target.access_suspended_at),
      revokedSessions: revoked?.rowCount || 0,
      revokedInvitations: invitations?.rowCount || 0,
    };
    await recordAudit(
      client,
      actor,
      action,
      kind === 'organizations' ? 'organization' : 'user',
      id,
      { ...metadata, reason },
    );
    await recordSecurityEvent(
      {
        eventType: action,
        success: true,
        actorUserId: actor.id,
        actorOrganizationId: actor.organizationId,
        sessionId: actor.sessionId,
        reason,
        metadata: { ...metadata, targetId: id },
      },
      client,
    );
    return { id, suspended, changed: true, revokedSessions: metadata.revokedSessions };
  });
}
