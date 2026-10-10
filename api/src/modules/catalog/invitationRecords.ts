import { AppError, ValidationError } from '../../errors';
import { Actor } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, text } from './paging';
const from =
  'FROM user_invitations i JOIN organizations o ON o.id=i.organization_id JOIN roles r ON r.id=i.role_id';
const scope = '($1::boolean OR i.organization_id=$2::uuid)';
const state =
  "CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.expires_at<=NOW() THEN 'expired' ELSE 'pending' END";
const fields =
  'i.id,i.email,i.expires_at,i.accepted_at,i.revoked_at,i.created_at,i.email_delivery_status,i.email_attempted_at,o.name AS organization_name,r.name AS role';
const args = (actor: Actor) => [actor.permissions.includes('*'), actor.organizationId];
function status(parameters: Record<string, unknown>) {
  const value = text(parameters.status, 'invitation status', 12) || 'all';
  if (!['all', 'pending', 'accepted', 'revoked', 'expired'].includes(value))
    throw new ValidationError('Invalid invitation status');
  return value;
}
export async function invitationSummary(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,
 COUNT(*) FILTER(WHERE ${state}='pending')::int AS pending_count,
 COUNT(*) FILTER(WHERE ${state}='accepted')::int AS accepted_count,
 COUNT(*) FILTER(WHERE ${state}='revoked')::int AS revoked_count,
 COUNT(*) FILTER(WHERE ${state}='expired')::int AS expired_count
 FROM user_invitations i WHERE ${scope}`,
      args(actor),
    )
  ).rows[0];
}
export async function invitationPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filter = status(parameters);
  const input = parsePage(
    parameters,
    ['invitations', actor.organizationId, [...actor.permissions].sort(), filter],
    ['status'],
  );
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
 SELECT i.id FROM user_invitations i JOIN organizations o ON o.id=i.organization_id JOIN roles r ON r.id=i.role_id
 WHERE ${scope} AND ($3::text='all' OR ${state}=$3::text)
 AND ($4::uuid IS NULL OR i.id<$4::uuid)
 AND ($5::text='' OR concat_ws(' ',i.email,o.name,r.name) ILIKE $6::text ESCAPE '\\')
 ORDER BY i.id DESC LIMIT $7::int)
 SELECT ${fields} ${from} JOIN candidates c ON c.id=i.id ORDER BY i.id DESC`,
      [
        ...args(actor),
        filter,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const count = (
    await execute(
      `SELECT COUNT(*)::int AS count FROM user_invitations i WHERE ${scope} AND ($3::text='all' OR ${state}=$3::text)`,
      [...args(actor), filter],
    )
  ).rows[0].count;
  return { ...pageResult(rows, input), count };
}
export async function legacyInvitations(execute: Execute, actor: Actor) {
  const ids = (
    await execute(
      `SELECT i.id FROM user_invitations i WHERE ${scope} ORDER BY i.id DESC LIMIT 1001`,
      args(actor),
    )
  ).rows;
  if (ids.length > 1000)
    throw new AppError(
      'Invitation history exceeds the complete list limit. Use paged search.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${fields} ${from} WHERE i.id=ANY($3::uuid[]) AND ${scope} ORDER BY i.created_at DESC,i.id DESC`,
      [...args(actor), ids.map((row) => row.id)],
    )
  ).rows;
}
