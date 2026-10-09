import type { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../../errors';
import { activeBatchRecallSql } from '../recall/safety';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

// EXISTS avoids duplicating notices linked through both a lot and its source batch.
export const publicNoticeRelationSql = (batchExpression: string, alias = 'r') => `(
 EXISTS(SELECT 1 FROM recall_affected_batches ab WHERE ab.recall_id=${alias}.id AND ab.batch_id=${batchExpression})
 OR EXISTS(SELECT 1 FROM recall_affected_lots al JOIN material_lots lot ON lot.id=al.lot_id WHERE al.recall_id=${alias}.id AND lot.batch_id=${batchExpression})
 OR EXISTS(SELECT 1 FROM recall_safety_holds held JOIN batch_holdings h ON held.entity_type='holding' AND h.id=held.entity_id WHERE held.recall_id=${alias}.id AND held.released_at IS NULL AND h.batch_id=${batchExpression})
 OR EXISTS(SELECT 1 FROM recall_recovery_records recovery JOIN batch_holdings h ON h.id=recovery.holding_id WHERE recovery.recall_id=${alias}.id AND (recovery.returned_kg>0 OR recovery.destroyed_kg>0) AND h.batch_id=${batchExpression}))`;
export const publicNoticeScope = `r.status IN ('active','resolved') AND ${publicNoticeRelationSql('$1::uuid')}`;
export async function publicNoticesPage(
  execute: Execute,
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) {
  const profile = (
    await execute(
      "SELECT id,batch_id FROM product_profiles WHERE slug=$1 AND visibility='published' LIMIT 1",
      [text(slug, 'product slug', 100)],
    )
  ).rows[0];
  if (
    !profile ||
    (expected && (profile.id !== expected.id || profile.batch_id !== expected.batchId))
  )
    throw new NotFoundError('Product profile');
  const status = parameters.status ?? 'all';
  if (typeof status !== 'string' || !['all', 'active', 'resolved'].includes(status))
    throw new ValidationError('Invalid notice status');
  const input = parsePage(
    parameters,
    ['public-notices', profile.id, profile.batch_id, status],
    ['status'],
  );
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
 SELECT r.id FROM recall_notices r WHERE ${publicNoticeScope}
 AND ($2::text='all' OR r.status=$2::text) AND ($3::uuid IS NULL OR r.id>$3::uuid)
 AND ($4::text='' OR concat_ws(' ',r.reference_code,r.title,r.reason,r.instructions) ILIKE $5::text ESCAPE '\\')
 ORDER BY r.id LIMIT $6::int)
 SELECT r.id,r.reference_code,r.title,r.reason,r.instructions,r.severity,r.status,r.initiated_at,r.resolved_at,o.name AS issued_by
 FROM candidates candidate JOIN recall_notices r ON r.id=candidate.id JOIN organizations o ON o.id=r.initiated_by_organization_id ORDER BY r.id`,
      [
        profile.batch_id,
        status,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const aggregate = (
    await execute(
      `SELECT COUNT(*)::int AS count,
 COUNT(*) FILTER(WHERE r.status='active')::int AS active_count,
 COUNT(*) FILTER(WHERE r.status='resolved')::int AS resolved_count,
 COUNT(*) FILTER(WHERE r.status='active' AND r.severity='critical')::int AS critical_count,
 COUNT(*) FILTER(WHERE r.status='active' AND r.severity='warning')::int AS warning_count,
 COUNT(*) FILTER(WHERE r.status='active' AND r.severity='advisory')::int AS advisory_count
 FROM recall_notices r WHERE ${publicNoticeScope}`,
      [profile.batch_id],
    )
  ).rows[0];
  const inventoryHeld = Boolean(
    (await execute(`SELECT ${activeBatchRecallSql('$1::uuid')} AS held`, [profile.batch_id]))
      .rows[0].held,
  );
  const safetyStatus =
    Number(aggregate.critical_count) > 0
      ? 'critical'
      : Number(aggregate.warning_count) > 0
        ? 'warning'
        : Number(aggregate.advisory_count) > 0
          ? 'advisory'
          : inventoryHeld
            ? 'warning'
            : 'clear';
  return {
    ...pageResult(rows, input),
    count: aggregate.count,
    safety: {
      status: safetyStatus,
      inventoryHeld,
      activeCount: aggregate.active_count,
      resolvedCount: aggregate.resolved_count,
      criticalCount: aggregate.critical_count,
      warningCount: aggregate.warning_count,
      advisoryCount: aggregate.advisory_count,
      checkedAt: new Date().toISOString(),
    },
  };
}
export const readPublicNotices = (
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) => withCatalogRead((execute) => publicNoticesPage(execute, slug, parameters, expected));
export async function getPublicNoticesPage(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store').json(await readPublicNotices(req.params.slug, req.query));
}
