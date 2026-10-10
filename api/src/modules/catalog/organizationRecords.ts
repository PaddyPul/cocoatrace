import { AppError, ForbiddenError, ValidationError } from '../../errors';
import { Actor } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, text } from './paging';

const organizationFields = 'o.id,o.name,o.type,o.jurisdiction,o.verification_status,o.created_at';
const memberFields = 'u.id,u.email,u.name,u.active,u.mfa_enabled,u.created_at';
const organizationScope = '(o.id=$1::uuid OR $2::boolean)';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function organizationArguments(actor: Actor, parameters: Record<string, unknown>) {
  return [actor.organizationId, actor.permissions.includes('*'), text(parameters.type, 'type')];
}
function memberScope(actor: Actor, organizationId: string) {
  if (!uuid.test(organizationId)) throw new ValidationError('Invalid organization ID');
  if (organizationId !== actor.organizationId && !actor.permissions.includes('*'))
    throw new ForbiddenError('Access denied');
}
const overflow = () =>
  new AppError(
    'Organization records exceed the complete list limit. Use paged search.',
    422,
    'CATALOG_READ_LIMIT',
  );

export async function organizationSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  parsePage(
    parameters,
    ['organization-summary', actor.organizationId, [...actor.permissions].sort()],
    ['type'],
  );
  return (
    await execute(
      `SELECT COUNT(*)::int AS count FROM organizations o WHERE ${organizationScope} AND ($3::text='' OR o.type=$3::text)`,
      organizationArguments(actor, parameters),
    )
  ).rows[0];
}
export async function organizationPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const args = organizationArguments(actor, parameters);
  const input = parsePage(
    parameters,
    ['organizations', ...args, [...actor.permissions].sort()],
    ['type'],
  );
  const rows = (
    await execute(
      `SELECT ${organizationFields} FROM organizations o WHERE ${organizationScope}
    AND ($3::text='' OR o.type=$3::text) AND ($4::uuid IS NULL OR o.id<$4::uuid)
    AND ($5::text='' OR concat_ws(' ',o.name,o.type,o.jurisdiction) ILIKE $6::text ESCAPE '\\') ORDER BY o.id DESC LIMIT $7::int`,
      [...args, input.cursor?.id || null, input.search, literal(input.search), input.limit + 1],
    )
  ).rows;
  const count = (
    await execute(
      `SELECT COUNT(*)::int AS count FROM organizations o WHERE ${organizationScope} AND ($3::text='' OR o.type=$3::text)
    AND ($4::text='' OR concat_ws(' ',o.name,o.type,o.jurisdiction) ILIKE $5::text ESCAPE '\\')`,
      [...args, input.search, literal(input.search)],
    )
  ).rows[0].count;
  return { ...pageResult(rows, input), count };
}
export async function legacyOrganizations(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  parsePage(parameters, ['legacy-organizations', actor.organizationId], ['type']);
  const args = organizationArguments(actor, parameters);
  const ids = (
    await execute(
      `SELECT o.id FROM organizations o WHERE ${organizationScope} AND ($3::text='' OR o.type=$3::text) ORDER BY o.id DESC LIMIT 1001`,
      args,
    )
  ).rows;
  if (ids.length > 1000) throw overflow();
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${organizationFields} FROM organizations o WHERE o.id=ANY($1::uuid[]) AND (o.id=$2::uuid OR $3::boolean) ORDER BY o.name,o.id`,
      [ids.map((row) => row.id), actor.organizationId, actor.permissions.includes('*')],
    )
  ).rows;
}
async function hydrateMembers(execute: Execute, organizationId: string, ids: unknown[]) {
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${memberFields},COALESCE((SELECT array_agg(DISTINCT r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),ARRAY[]::text[]) AS roles
    FROM users u WHERE u.organization_id=$1::uuid AND u.id=ANY($2::uuid[]) ORDER BY u.id DESC`,
      [organizationId, ids],
    )
  ).rows;
}
export async function memberSummary(execute: Execute, actor: Actor, organizationId: string) {
  memberScope(actor, organizationId);
  return (
    await execute('SELECT COUNT(*)::int AS count FROM users WHERE organization_id=$1::uuid', [
      organizationId,
    ])
  ).rows[0];
}
export async function memberPage(
  execute: Execute,
  actor: Actor,
  organizationId: string,
  parameters: Record<string, unknown> = {},
) {
  memberScope(actor, organizationId);
  const input = parsePage(
    parameters,
    ['organization-members', actor.organizationId, [...actor.permissions].sort(), organizationId],
    [],
  );
  const rows = (
    await execute(
      `SELECT u.id FROM users u WHERE u.organization_id=$1::uuid AND ($2::uuid IS NULL OR u.id<$2::uuid)
    AND ($3::text='' OR concat_ws(' ',u.name,u.email) ILIKE $4::text ESCAPE '\\') ORDER BY u.id DESC LIMIT $5::int`,
      [
        organizationId,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const result = pageResult(rows, input);
  const count = (
    await execute(
      `SELECT COUNT(*)::int AS count FROM users u WHERE u.organization_id=$1::uuid AND ($2::text='' OR concat_ws(' ',u.name,u.email) ILIKE $3::text ESCAPE '\\')`,
      [organizationId, input.search, literal(input.search)],
    )
  ).rows[0].count;
  return {
    ...result,
    items: await hydrateMembers(
      execute,
      organizationId,
      result.items.map((row) => row.id),
    ),
    count,
  };
}
export async function legacyMembers(execute: Execute, actor: Actor, organizationId: string) {
  memberScope(actor, organizationId);
  const ids = (
    await execute(
      'SELECT id FROM users WHERE organization_id=$1::uuid ORDER BY id DESC LIMIT 1001',
      [organizationId],
    )
  ).rows;
  if (ids.length > 1000) throw overflow();
  return hydrateMembers(
    execute,
    organizationId,
    ids.map((row) => row.id),
  );
}
