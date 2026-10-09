import type { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { type Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { recallScope, recallTotals } from './workspace';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const from = 'FROM recall_notices r JOIN organizations o ON o.id=r.initiated_by_organization_id';
const fields = `r.*,o.name AS issued_by,
 (SELECT COUNT(*)::int FROM recall_affected_batches ab WHERE ab.recall_id=r.id) AS batch_count,
 (SELECT COUNT(*)::int FROM recall_affected_lots al WHERE al.recall_id=r.id) AS affected_lot_count`;
function filters(parameters: Record<string, unknown>) {
  const status = text(parameters.status, 'recall status', 12) || 'all';
  const severity = text(parameters.severity, 'recall severity', 12) || 'all';
  if (
    !['all', 'draft', 'active', 'resolved'].includes(status) ||
    !['all', 'advisory', 'warning', 'critical'].includes(severity)
  )
    throw new ValidationError('Invalid recall filter');
  return { status, severity };
}
export async function recallPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const filter = filters(parameters),
    all = hasExplicitPermission(actor, 'recall.manage.all');
  const input = parsePage(
    parameters,
    ['recalls', actor.organizationId, all, filter],
    ['status', 'severity'],
  );
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
 SELECT r.*,o.name AS issued_by ${from} WHERE ${recallScope}
 AND ($3::text='all' OR r.status=$3::text) AND ($4::text='all' OR r.severity=$4::text)
 AND ($5::uuid IS NULL OR r.id>$5::uuid)
 AND ($6::text='' OR concat_ws(' ',r.id,r.reference_code,r.title,r.reason,r.instructions,o.name) ILIKE $7::text ESCAPE '\\')
 ORDER BY r.id LIMIT $8::int)
 SELECT candidates.*,
 (SELECT COUNT(*)::int FROM recall_affected_batches ab WHERE ab.recall_id=candidates.id) AS batch_count,
 (SELECT COUNT(*)::int FROM recall_affected_lots al WHERE al.recall_id=candidates.id) AS affected_lot_count
 FROM candidates ORDER BY id`,
      [
        actor.organizationId,
        all,
        filter.status,
        filter.severity,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  return pageResult(rows, input);
}
export async function recallSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).length)
    throw new ValidationError('Recall totals accept no parameters');
  return recallTotals(execute, actor);
}
export async function legacyRecalls(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).length) throw new ValidationError('Use recall pages for filters');
  const rows = (
    await execute(`SELECT ${fields} ${from} WHERE ${recallScope} ORDER BY r.id LIMIT 1001`, [
      actor.organizationId,
      hasExplicitPermission(actor, 'recall.manage.all'),
    ])
  ).rows;
  const references = rows.reduce(
    (total, row) => total + Number(row.batch_count) + Number(row.affected_lot_count),
    0,
  );
  if (rows.length > 1000 || references > 1000)
    throw new AppError(
      'Recall history exceeds the legacy limit. Use the paged recall register.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!rows.length) return [];
  const linked = (
    await execute(
      `SELECT r.id,
 COALESCE((SELECT array_agg(ab.batch_id) FROM recall_affected_batches ab WHERE ab.recall_id=r.id),'{}') AS batch_ids,
 COALESCE((SELECT json_agg(json_build_object('lotId',al.lot_id,'lotCode',ml.lot_code,'sourceEquivalentKg',al.source_equivalent_kg,'recallQuantityKg',al.recall_quantity_kg,'relationshipDepth',al.relationship_depth) ORDER BY al.relationship_depth,ml.lot_code) FROM recall_affected_lots al JOIN material_lots ml ON ml.id=al.lot_id WHERE al.recall_id=r.id),'[]'::json) AS affected_lots
 FROM recall_notices r WHERE r.id=ANY($1::uuid[])`,
      [rows.map((row) => row.id)],
    )
  ).rows;
  const byId = new Map(linked.map((row) => [row.id, row]));
  return rows.map((row) => ({ ...row, ...byId.get(row.id) }));
}
export async function listRecallPage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => recallPage(execute, req.user!, req.query)));
}
export async function summarizeRecalls(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => recallSummary(execute, req.user!, req.query)));
}
