import type { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const select = `SELECT c.*,s.name AS seller_name,b.name AS buyer_name,h.quantity_kg AS holding_qty,
 ROUND(c.quantity_kg*c.price_per_kg,c.currency_minor_units) AS trade_value`;
const from = `FROM sales_contracts c JOIN organizations s ON s.id=c.seller_organization_id
 JOIN organizations b ON b.id=c.buyer_organization_id JOIN batch_holdings h ON h.id=c.holding_id`;
const party = '(c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid)';
const active = "c.status NOT IN ('settled','cancelled')";
export function contractFilters(parameters: Record<string, unknown>) {
  const direction = text(parameters.direction, 'contract direction', 9) || 'all';
  const status = text(parameters.status, 'contract status', 24) || 'all';
  if (!['all', 'purchases', 'sales'].includes(direction))
    throw new ValidationError('Invalid contract direction');
  if (
    ![
      'all',
      'active',
      'accepted',
      'fulfilment_in_progress',
      'in_transit',
      'delivered',
      'delivered_payment_risk',
      'settled',
      'cancelled',
    ].includes(status)
  )
    throw new ValidationError('Invalid contract status');
  return { direction, status };
}
export async function contractPage(
  execute: Execute,
  organizationId: string,
  parameters: Record<string, unknown>,
) {
  const filters = contractFilters(parameters);
  const input = parsePage(
    parameters,
    ['contracts', organizationId, filters],
    ['direction', 'status'],
  );
  const result = await execute(
    `${select} ${from} WHERE ${party}
 AND ($2::uuid IS NULL OR c.id>$2::uuid)
 AND ($3::text='all' OR ($3::text='purchases' AND c.buyer_organization_id=$1::uuid) OR ($3::text='sales' AND c.seller_organization_id=$1::uuid))
 AND ($4::text='all' OR ($4::text='active' AND ${active}) OR c.status=$4::text)
 AND ($5::text='' OR concat_ws(' ',c.id,c.listing_id,c.offer_id,s.name,b.name,c.incoterm,c.status) ILIKE $6::text ESCAPE '\\')
 ORDER BY c.id LIMIT $7::int`,
    [
      organizationId,
      input.cursor?.id || null,
      filters.direction,
      filters.status,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function contractSummary(execute: Execute, organizationId: string) {
  const totals = await execute(
    `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE ${active})::int AS active_count,
 COUNT(*) FILTER(WHERE c.status='settled')::int AS settled_count,COUNT(*) FILTER(WHERE c.status='cancelled')::int AS cancelled_count
 FROM sales_contracts c WHERE ${party}`,
    [organizationId],
  );
  const latest = await execute(
    `SELECT c.id FROM sales_contracts c WHERE ${party} AND ${active} ORDER BY c.created_at DESC,c.id DESC LIMIT 1`,
    [organizationId],
  );
  return { ...totals.rows[0], latest_active_id: latest.rows[0]?.id || null };
}
export async function legacyContracts(execute: Execute, organizationId: string) {
  const result = await execute(
    `${select} ${from} WHERE ${party} ORDER BY c.created_at DESC,c.id DESC LIMIT 1001`,
    [organizationId],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Contract history exceeds the legacy limit. Use the paged deals view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
export async function listContractPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) => contractPage(execute, req.user!.organizationId, req.query)),
  );
}
export async function summarizeContracts(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => contractSummary(execute, req.user!.organizationId)));
}
