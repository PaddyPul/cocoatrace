import type { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const select = `SELECT p.*,c.seller_organization_id,c.buyer_organization_id,c.payment_plan,c.payment_terms_status,c.deposit_percentage`;
const from = `FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id`;
const party = '(c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid)';
const open = "p.status<>'settled' AND c.status NOT IN ('settled','cancelled')";
export const paymentStates = [
  'awaiting_terms',
  'awaiting_security',
  'awaiting_delivery',
  'awaiting_documents',
  'payment_due',
  'payment_pending_verification',
  'partially_paid',
  'settled',
];
export function paymentFilters(parameters: Record<string, unknown>) {
  const direction = text(parameters.direction, 'payment direction', 9) || 'all';
  const status = text(parameters.status, 'payment status', 30) || 'all';
  const currency = text(parameters.currency, 'payment currency', 3).toUpperCase();
  if (!['all', 'purchases', 'sales'].includes(direction))
    throw new ValidationError('Invalid payment direction');
  if (!['all', 'open', 'cancelled', ...paymentStates].includes(status))
    throw new ValidationError('Invalid payment status');
  if (currency && !/^[A-Z]{3}$/.test(currency))
    throw new ValidationError('Invalid payment currency');
  return { direction, status, currency };
}
export async function paymentPage(
  execute: Execute,
  organizationId: string,
  parameters: Record<string, unknown>,
) {
  const filters = paymentFilters(parameters),
    input = parsePage(
      parameters,
      ['payments', organizationId, filters],
      ['direction', 'status', 'currency'],
    );
  const result = await execute(
    `${select} ${from} WHERE ${party}
 AND ($2::uuid IS NULL OR p.id>$2::uuid)
 AND ($3::text='all' OR ($3::text='purchases' AND c.buyer_organization_id=$1::uuid) OR ($3::text='sales' AND c.seller_organization_id=$1::uuid))
 AND ($4::text='all' OR ($4::text='open' AND ${open}) OR ($4::text='cancelled' AND c.status='cancelled') OR ($4::text NOT IN ('all','open','cancelled') AND p.status=$4::text))
 AND ($5::text='' OR p.currency=$5::text)
 AND ($6::text='' OR concat_ws(' ',p.id,p.contract_id,p.status,p.currency,p.payment_reference_external,c.payment_plan) ILIKE $7::text ESCAPE '\\')
 ORDER BY p.id LIMIT $8::int`,
    [
      organizationId,
      input.cursor?.id || null,
      filters.direction,
      filters.status,
      filters.currency,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function paymentSummary(execute: Execute, organizationId: string) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,
 COUNT(*) FILTER(WHERE ${open})::int AS open_count,
 COUNT(*) FILTER(WHERE p.status='settled')::int AS settled_count,
 COUNT(*) FILTER(WHERE c.status='cancelled')::int AS cancelled_count
 ${from} WHERE ${party}`,
      [organizationId],
    )
  ).rows[0];
}
export async function legacyPayments(execute: Execute, organizationId: string) {
  const result = await execute(
    `${select} ${from} WHERE ${party} ORDER BY p.created_at DESC,p.id DESC LIMIT 1001`,
    [organizationId],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Payment history exceeds the legacy limit. Use the paged payment view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
export async function listPaymentPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) => paymentPage(execute, req.user!.organizationId, req.query)),
  );
}
export async function summarizePayments(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => paymentSummary(execute, req.user!.organizationId)));
}
