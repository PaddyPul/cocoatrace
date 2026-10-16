import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { AppError, NotFoundError } from '../../errors';
import { lockAccessDecisions } from '../mfa/reviewers';
import { assertMutationAssurance } from '../mfa/assurance';
import { assignable, boundedRole, family } from './policy';
type Role = { name: string; permissions: string[]; id: string };
const fail = (message: string, code = 'FORBIDDEN'): never => {
  throw new AppError(message, 403, code);
};
async function context(client: PoolClient, actor: AuthenticatedActor, allMembers = true) {
  await lockAccessDecisions(client);
  const org = (
    await client.query('SELECT * FROM organizations WHERE id=$1 FOR UPDATE', [actor.organizationId])
  ).rows[0];
  if (!org) fail('Organization unavailable');
  family(org.type);
  const roles = (
    await client.query('SELECT id,name,permissions FROM roles ORDER BY name FOR SHARE')
  ).rows as Role[];
  const users = (
    await client.query(
      `SELECT u.*,COALESCE((SELECT json_agg(json_build_object('id',r.id,'name',r.name,'permissions',r.permissions)) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),'[]'::json) AS roles FROM users u WHERE organization_id=$1 AND ($2::uuid IS NULL OR u.id=$2) ORDER BY id LIMIT 501 FOR UPDATE`,
      [actor.organizationId, allMembers ? null : actor.id],
    )
  ).rows;
  if (users.length > 500)
    throw new AppError(
      'Team size exceeds the supported management limit; contact support',
      409,
      'TEAM_SIZE_LIMIT',
    );
  const live = users.find((u) => u.id === actor.id);
  const session = (
    await client.query(
      'SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() FOR SHARE',
      [actor.sessionId, actor.id],
    )
  ).rows[0];
  const permissions: string[] = live?.roles.flatMap((r: Role) => r.permissions) || [];
  if (
    !live ||
    !session ||
    !live.active ||
    live.access_suspended_at ||
    org.access_suspended_at ||
    org.verification_status !== 'verified' ||
    !permissions.includes('member.manage')
  )
    fail('Authorization changed; sign in again');
  if (
    live.roles.length !== 1 ||
    live.roles[0].name !== `${family(org.type)}_admin` ||
    !boundedRole(live.roles[0].name, live.roles[0].permissions, org.type)
  )
    fail('Administrator role is not bounded');
  if (
    (
      await client.query(
        `SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.organization_id=$1 AND '*'=ANY(r.permissions) LIMIT 1`,
        [actor.organizationId],
      )
    ).rows[0]
  )
    fail('Protected organization', 'PROTECTED_MEMBER');
  return { org, users, live, permissions, roles };
}
export async function listMembers(
  actor: AuthenticatedActor,
  input: { limit: number; search: string; cursor?: string },
) {
  return inDatabaseTransaction(async (client) => {
    const c = await context(client, actor, false);
    const matches = (
      await client.query(
        `SELECT u.id,u.name,u.email,u.active,u.access_suspended_at,COALESCE((SELECT json_agg(json_build_object('id',r.id,'name',r.name,'permissions',r.permissions)) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),'[]'::json) AS roles FROM users u WHERE u.organization_id=$1 AND ($2='' OR POSITION($2 IN lower(u.name))>0 OR POSITION($2 IN lower(u.email))>0) AND ($3::uuid IS NULL OR u.id>$3) ORDER BY u.id LIMIT $4`,
        [actor.organizationId, input.search.toLowerCase(), input.cursor || null, input.limit + 1],
      )
    ).rows;
    const rows = matches.slice(0, input.limit).map((u) => {
      const role =
        u.roles.length === 1 && boundedRole(u.roles[0].name, u.roles[0].permissions, c.org.type)
          ? u.roles[0].name
          : null;
      const legacy =
        u.roles.length === 1 &&
        u.roles[0].name === c.org.type &&
        ['importer', 'exporter'].includes(c.org.type);
      const manageable =
        u.id !== actor.id &&
        (!!role || legacy) &&
        u.roles.every((r: Role) => r.permissions.every((p) => c.permissions.includes(p)));
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        accessSuspended: !!u.access_suspended_at,
        roles: u.roles.map((r: Role) => r.name),
        role,
        legacy,
        manageable,
      };
    });
    return { rows, next: matches.length > input.limit ? rows[rows.length - 1].id : null };
  });
}
export async function listRoles(actor: AuthenticatedActor) {
  return inDatabaseTransaction(async (client) => {
    const c = await context(client, actor, false);
    return {
      rows: c.roles
        .filter((r) => assignable(r.name, r.permissions, c.permissions, c.org.type))
        .map(({ name, permissions }) => ({ name, permissions })),
    };
  });
}
export async function changeMember(
  actor: AuthenticatedActor,
  id: string,
  input: { role?: string; reason: string; currentPassword: string },
) {
  return inDatabaseTransaction(async (client) => {
    const c = await context(client, actor);
    const target = c.users.find((u) => u.id === id);
    if (!target) throw new NotFoundError('Member');
    if (id === actor.id) fail('You cannot change your own membership', 'SELF_CHANGE_FORBIDDEN');
    await assertMutationAssurance(client, actor);
    if (!(await bcrypt.compare(input.currentPassword, c.live.password_hash)))
      fail('Confirm your current password', 'REAUTHENTICATION_REQUIRED');
    const legacy =
      target.roles.length === 1 &&
      target.roles[0].name === c.org.type &&
      ['importer', 'exporter'].includes(c.org.type);
    if (
      target.roles.length !== 1 ||
      (!legacy && !boundedRole(target.roles[0].name, target.roles[0].permissions, c.org.type)) ||
      !target.roles.every((r: Role) => r.permissions.every((p) => c.permissions.includes(p)))
    )
      fail('Protected member role', 'PROTECTED_MEMBER');
    const role = input.role ? c.roles.find((r) => r.name === input.role) : undefined;
    if (
      input.role &&
      (!role || !assignable(role.name, role.permissions, c.permissions, c.org.type))
    )
      fail('Role is not assignable', 'ROLE_NOT_ASSIGNABLE');
    const usableAdmin = (u: typeof target) =>
      u.active &&
      !u.access_suspended_at &&
      u.roles.length === 1 &&
      u.roles[0].name === `${family(c.org.type)}_admin` &&
      boundedRole(u.roles[0].name, u.roles[0].permissions, c.org.type);
    if (
      usableAdmin(target) &&
      (!role || role.name !== target.roles[0].name) &&
      c.users.filter(usableAdmin).length <= 1
    )
      fail('Keep at least one usable administrator', 'LAST_ADMIN_PROTECTED');
    const changed = role ? target.roles[0].id !== role.id : target.active;
    if (!changed) return { id, changed: false, revokedSessions: 0 };
    if (role) {
      await client.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
      await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, role.id]);
    } else await client.query('UPDATE users SET active=false WHERE id=$1', [id]);
    const revoked = await client.query(
      "UPDATE sessions SET revoked_at=NOW(),revoked_reason='team.member.changed' WHERE user_id=$1 AND revoked_at IS NULL",
      [id],
    );
    await client.query(
      'UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
      [id],
    );
    await client.query('DELETE FROM mfa_challenges WHERE user_id=$1', [id]);
    await client.query('UPDATE users SET mfa_recovery_approved_until=NULL WHERE id=$1', [id]);
    await client.query(
      'UPDATE user_invitations SET revoked_at=NOW() WHERE invited_by_user_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',
      [id],
    );
    if (!role)
      await client.query(
        'UPDATE user_passkeys SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1',
        [id],
      );
    await recordAudit(
      client,
      actor,
      role ? 'team.member.role_changed' : 'team.member.deactivated',
      'user',
      id,
      {
        reason: input.reason,
        previousRoles: target.roles.map((r: Role) => r.name),
        role: role?.name || null,
        revokedSessions: revoked.rowCount || 0,
      },
    );
    return { id, changed: true, revokedSessions: revoked.rowCount || 0 };
  });
}
