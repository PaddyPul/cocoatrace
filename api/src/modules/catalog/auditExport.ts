import { AppError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { Execute, text, withCatalogRead } from './paging';

export const AUDIT_EXPORT_MAX_RECORDS = 1000;
export const AUDIT_EXPORT_MAX_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function auditExportFilters(parameters: Record<string, unknown>) {
  if (Object.keys(parameters).some((name) => !['entityType', 'entityId'].includes(name)))
    throw new ValidationError('Unknown audit export parameter');
  const entityType = text(parameters.entityType, 'entity type');
  const entityId = text(parameters.entityId, 'entity ID');
  if (
    Boolean(entityType) !== Boolean(entityId) ||
    (entityType && !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(entityType)) ||
    (entityId && !UUID.test(entityId))
  )
    throw new ValidationError(
      'Audit export requires a valid entityType and UUID entityId together',
    );
  return { entityType: entityType || null, entityId: entityId || null };
}
function overflow(): never {
  throw new AppError(
    'Audit export exceeds the complete report limit. Narrow the entity filter; no partial file was generated.',
    422,
    'AUDIT_EXPORT_LIMIT',
  );
}
export async function auditExportRead(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filters = auditExportFilters(parameters);
  const arguments_ = [
    hasExplicitPermission(actor, 'audit.export.all'),
    actor.organizationId,
    filters.entityType,
    filters.entityId,
  ];
  const scope = `($1::boolean OR actor_organization_id=$2::uuid)
    AND ($3::text IS NULL OR entity_type=$3::text)
    AND ($4::uuid IS NULL OR entity_id=$4::uuid)`;
  // Detect record overflow using IDs only, before retrieving potentially large metadata.
  const candidates = (
    await execute(
      `SELECT id FROM audit_events WHERE ${scope}
    ORDER BY occurred_at DESC,id DESC LIMIT ${AUDIT_EXPORT_MAX_RECORDS + 1}`,
      arguments_,
    )
  ).rows;
  if (candidates.length > AUDIT_EXPORT_MAX_RECORDS) overflow();
  if (!candidates.length) return { payload: '[]', count: 0, bytes: 2, filters };
  const ids = candidates.map((row) => row.id);
  // Aggregate serialized byte size inside PostgreSQL before materializing complete records in Node.
  const size = (
    await execute(
      `SELECT COALESCE(SUM(octet_length(row_to_json(a)::text)),0)::text AS bytes
    FROM audit_events a WHERE ${scope} AND id=ANY($5::uuid[])`,
      [...arguments_, ids],
    )
  ).rows[0];
  const projectedBytes = Number(size?.bytes);
  if (!Number.isSafeInteger(projectedBytes) || projectedBytes < 0)
    throw new AppError('Audit export size could not be verified', 503, 'AUDIT_EXPORT_UNAVAILABLE');
  if (projectedBytes + ids.length + 2 > AUDIT_EXPORT_MAX_BYTES) overflow();
  const rows = (
    await execute(
      `SELECT * FROM audit_events WHERE ${scope} AND id=ANY($5::uuid[])
    ORDER BY occurred_at DESC,id DESC`,
      [...arguments_, ids],
    )
  ).rows;
  if (rows.length !== ids.length)
    throw new AppError('Audit export snapshot changed; retry', 503, 'AUDIT_EXPORT_UNAVAILABLE');
  const payload = JSON.stringify(rows);
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (bytes > AUDIT_EXPORT_MAX_BYTES) overflow();
  return { payload, count: rows.length, bytes, filters };
}
export async function completeAuditExport(actor: Actor, parameters: Record<string, unknown> = {}) {
  auditExportFilters(parameters);
  return withCatalogRead((execute) => auditExportRead(execute, actor, parameters));
}
