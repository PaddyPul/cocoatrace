import type { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { config } from '../../config/env';
import { type Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { activeBatchRecallSql } from '../recall/safety';
import { legacyOrganicStatus, loadBatchTrust } from '../trust/assessment';
import { productScope, productTotals } from './workspace';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const from =
  'FROM product_profiles pp JOIN harvest_batches b ON b.id=pp.batch_id LEFT JOIN farms f ON f.id=b.farm_id';
const fields = `pp.*,b.crop,b.harvest_date,b.quantity_kg,b.organic_claim_status,
 f.name AS farm_name,COALESCE(f.region,b.source_region) AS region,COALESCE(f.country,b.source_country) AS country,
 (SELECT name FROM organizations WHERE id=b.current_holder_id) AS current_holder_name`;
const severity = (
  batch: string,
) => `(SELECT notice.severity FROM recall_notices notice WHERE notice.status='active'
 AND (EXISTS(SELECT 1 FROM recall_affected_batches ab WHERE ab.recall_id=notice.id AND ab.batch_id=${batch})
 OR EXISTS(SELECT 1 FROM recall_affected_lots al JOIN material_lots lot ON lot.id=al.lot_id WHERE al.recall_id=notice.id AND lot.batch_id=${batch}))
 ORDER BY CASE notice.severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END DESC LIMIT 1)`;
function visibility(parameters: Record<string, unknown>) {
  const value = text(parameters.visibility, 'product visibility', 12) || 'all';
  if (!['all', 'draft', 'published', 'archived', 'attention'].includes(value))
    throw new ValidationError('Invalid product visibility');
  return value;
}
async function decorate(execute: Execute, rows: Record<string, unknown>[]) {
  const ids = [...new Set(rows.map((row) => String(row.batch_id)))];
  const trusts = await loadBatchTrust(ids, execute, true);
  return rows.map((row) => ({
    ...row,
    trust: trusts.get(String(row.batch_id)),
    organic_claim_status: legacyOrganicStatus(trusts.get(String(row.batch_id))!),
    safety_status: row.active_severity || (row.inventory_held ? 'warning' : 'clear'),
    profileUrl: `${config.publicWebUrl}/p/${row.slug}`,
    qrSvgUrl: `/public/products/${row.slug}/qr.svg`,
  }));
}
export async function productPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const filter = visibility(parameters),
    all = hasExplicitPermission(actor, 'product_profile.read.all');
  const input = parsePage(
    parameters,
    ['products', actor.organizationId, all, filter],
    ['visibility'],
  );
  // Limit the candidate set before per-profile metadata counts and trust decoration.
  const result = await execute(
    `WITH candidates AS MATERIALIZED (
 SELECT ${fields},${activeBatchRecallSql('b.id')} AS inventory_held ${from} WHERE ${productScope}
 AND ($3::text IN ('all','attention') OR pp.visibility=$3::text)
 AND ($3::text<>'attention' OR ${activeBatchRecallSql('b.id')})
 AND ($4::uuid IS NULL OR pp.id>$4::uuid)
 AND ($5::text='' OR concat_ws(' ',pp.id,pp.display_name,pp.brand_name,pp.lot_code,b.crop,f.name,COALESCE(f.region,b.source_region),COALESCE(f.country,b.source_country)) ILIKE $6::text ESCAPE '\\')
 ORDER BY pp.id LIMIT $7::int)
 SELECT candidates.*,${severity('candidates.batch_id')} AS active_severity,
 (SELECT COUNT(*)::int FROM product_profile_scans scan WHERE scan.product_profile_id=candidates.id) AS scan_count,
 (SELECT COUNT(*)::int FROM evidence_items evidence WHERE evidence.linked_entity_type='batch' AND evidence.linked_entity_id=candidates.batch_id) AS evidence_count
 FROM candidates ORDER BY id`,
    [
      actor.organizationId,
      all,
      filter,
      input.cursor?.id || null,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  const page = pageResult(result.rows, input);
  return { ...page, items: await decorate(execute, page.items) };
}
export async function productSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).length)
    throw new ValidationError('Product totals accept no parameters');
  return productTotals(execute, actor);
}
export async function legacyProducts(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).length)
    throw new ValidationError('Use the paged product register for filters');
  const rows = (
    await execute(
      `SELECT ${fields},${activeBatchRecallSql('b.id')} AS inventory_held,${severity('b.id')} AS active_severity,
 (SELECT COUNT(*)::int FROM product_profile_scans scan WHERE scan.product_profile_id=pp.id) AS scan_count,
 (SELECT COUNT(*)::int FROM evidence_items evidence WHERE evidence.linked_entity_type='batch' AND evidence.linked_entity_id=pp.batch_id) AS evidence_count
 ${from} WHERE ${productScope} ORDER BY pp.id LIMIT 1001`,
      [actor.organizationId, hasExplicitPermission(actor, 'product_profile.read.all')],
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Product history exceeds the legacy limit. Use the paged product register.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return decorate(execute, rows);
}
export async function listProductPage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => productPage(execute, req.user!, req.query)));
}
export async function summarizeProducts(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => productSummary(execute, req.user!, req.query)));
}
