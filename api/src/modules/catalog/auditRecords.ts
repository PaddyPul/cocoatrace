import { AppError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields =
  'a.id,a.occurred_at,a.action,a.entity_type,a.entity_id,a.actor_user_id,a.actor_organization_id,a.previous_state_hash,a.new_state_hash,a.reason';
const scope = `($1::boolean OR a.actor_organization_id=$2::uuid) AND ($3::text='' OR a.entity_type=$3::text) AND ($4::uuid IS NULL OR a.entity_id=$4::uuid) AND ($5::text='' OR a.action=$5::text)`;
const time = '(extract(epoch FROM a.occurred_at)*1000+62135596800000)::numeric';
// Split whole seconds and the sub-second remainder to preserve microseconds without a large floating-point epoch.
const cursorTime = `to_timestamp(floor(($6::numeric-62135596800000)/1000)::double precision) + ((($6::numeric-62135596800000)-floor(($6::numeric-62135596800000)/1000)*1000)::text||' milliseconds')::interval`;
export function auditRecordFilters(parameters: Record<string, unknown>, paging = true) {
  const allowed = [
    'entityType',
    'entityId',
    'action',
    ...(paging ? ['limit', 'search', 'cursor', 'sort'] : []),
  ];
  if (Object.keys(parameters).some((key) => !allowed.includes(key)))
    throw new ValidationError('Unknown audit register parameter');
  const entityType = text(parameters.entityType, 'entity type'),
    entityId = text(parameters.entityId, 'entity ID'),
    action = text(parameters.action, 'action');
  if (
    (entityType && !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(entityType)) ||
    (entityId && !UUID.test(entityId))
  )
    throw new ValidationError('Invalid audit entity filter');
  return { entityType, entityId, action };
}
function argumentsFor(actor: Actor, filters: ReturnType<typeof auditRecordFilters>) {
  return [
    hasExplicitPermission(actor, 'audit.read.all'),
    actor.organizationId,
    filters.entityType,
    filters.entityId || null,
    filters.action,
  ];
}
export async function auditRecordSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filters = auditRecordFilters(parameters, false);
  const row = (
    await execute(
      `SELECT COUNT(*)::int AS count,MAX(a.occurred_at) AS latest_at FROM audit_events a WHERE ${scope}`,
      argumentsFor(actor, filters),
    )
  ).rows[0];
  return { count: row.count, latestAt: row.latest_at };
}
export async function auditRecordPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filters = auditRecordFilters(parameters);
  const input = parsePage(
    parameters,
    ['audit-register', actor.organizationId, [...actor.permissions].sort(), filters],
    ['entityType', 'entityId', 'action'],
    ['time'],
  );
  if (input.cursor && BigInt(input.cursor.key.split('.')[0]) > 315537897599999n)
    throw new ValidationError('Invalid audit time cursor; restart the search');
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (SELECT a.id,${time} AS sort_key FROM audit_events a WHERE ${scope}
 AND ($6::numeric IS NULL OR (a.occurred_at,a.id)<(${cursorTime},$7::uuid))
 AND ($8::text='' OR concat_ws(' ',a.action,a.entity_type,a.entity_id::text,a.reason) ILIKE $9::text ESCAPE '\\') ORDER BY a.occurred_at DESC,a.id DESC LIMIT $10::int)
 SELECT ${fields},candidate.sort_key FROM candidates candidate JOIN audit_events a ON a.id=candidate.id ORDER BY a.occurred_at DESC,a.id DESC`,
      [
        ...argumentsFor(actor, filters),
        input.cursor?.key || null,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const summary = await auditRecordSummary(execute, actor, filters);
  const page = pageResult(rows, input, 'sort_key');
  return {
    ...page,
    count: summary.count,
    latestAt: summary.latestAt,
    items: page.items.map(({ sort_key: _sort, ...row }) => row),
  };
}
export async function legacyAuditRecords(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filters = auditRecordFilters(parameters, false),
    arguments_ = argumentsFor(actor, filters);
  const rows = (
    await execute(
      `SELECT a.id FROM audit_events a WHERE ${scope} ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1001`,
      arguments_,
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Audit history exceeds the legacy read limit. Use paged audit records.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!rows.length) return [];
  return (
    await execute(
      `SELECT ${fields} FROM audit_events a WHERE ${scope} AND a.id=ANY($6::uuid[]) ORDER BY a.occurred_at DESC,a.id DESC`,
      [...arguments_, rows.map((row) => row.id)],
    )
  ).rows;
}
export const readAuditRecords = (actor: Actor, parameters: Record<string, unknown> = {}) =>
  withCatalogRead((execute) => auditRecordPage(execute, actor, parameters));
export const readAuditSummary = (actor: Actor, parameters: Record<string, unknown> = {}) =>
  withCatalogRead((execute) => auditRecordSummary(execute, actor, parameters));
