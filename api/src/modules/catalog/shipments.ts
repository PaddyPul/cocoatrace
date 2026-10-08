import type { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { milestoneOrder } from '../transport/responsibilities';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const select = `SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.incoterm,c.payment_plan,c.payment_terms_status,p.amount_confirmed,p.dispatch_required_amount,p.security_status,p.release_status,
            coordinator.name as transport_coordinator_name
`;
const from = `FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
`;
const party = '(c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid)';
const active = "sh.current_milestone<>'delivered' AND c.status NOT IN ('settled','cancelled')";
export function shipmentFilters(parameters: Record<string, unknown>) {
  const direction = text(parameters.direction, 'shipment direction', 9) || 'all';
  const status = text(parameters.status, 'transport state', 9) || 'all';
  const milestone = text(parameters.milestone, 'transport milestone', 20) || 'all';
  if (!['all', 'purchases', 'sales'].includes(direction))
    throw new ValidationError('Invalid shipment direction');
  if (!['all', 'active', 'delivered', 'cancelled'].includes(status))
    throw new ValidationError('Invalid transport state');
  if (milestone !== 'all' && !milestoneOrder.some((value) => value === milestone))
    throw new ValidationError('Invalid transport milestone');
  return { direction, status, milestone };
}
export async function shipmentPage(
  execute: Execute,
  organizationId: string,
  parameters: Record<string, unknown>,
) {
  const filters = shipmentFilters(parameters),
    input = parsePage(
      parameters,
      ['shipments', organizationId, filters],
      ['direction', 'status', 'milestone'],
    );
  const result = await execute(
    `${select} ${from} WHERE ${party}
 AND ($2::uuid IS NULL OR sh.id>$2::uuid)
 AND ($3::text='all' OR ($3::text='purchases' AND c.buyer_organization_id=$1::uuid) OR ($3::text='sales' AND c.seller_organization_id=$1::uuid))
 AND ($4::text='all' OR ($4::text='active' AND ${active}) OR ($4::text='delivered' AND sh.current_milestone='delivered') OR ($4::text='cancelled' AND c.status='cancelled'))
 AND ($5::text='all' OR sh.current_milestone=$5::text)
 AND ($6::text='' OR concat_ws(' ',sh.id,sh.contract_id,sh.service_provider_name,sh.booking_reference,sh.transport_document_reference,sh.container_reference,sh.origin_port,sh.destination_port,sh.current_milestone,coordinator.name,c.incoterm) ILIKE $7::text ESCAPE '\\')
 ORDER BY sh.id LIMIT $8::int`,
    [
      organizationId,
      input.cursor?.id || null,
      filters.direction,
      filters.status,
      filters.milestone,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function shipmentSummary(execute: Execute, organizationId: string) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,
 COUNT(*) FILTER(WHERE ${active})::int AS active_count,
 COUNT(*) FILTER(WHERE sh.current_milestone='delivered')::int AS delivered_count,
 COUNT(*) FILTER(WHERE c.status='cancelled')::int AS cancelled_count
 FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id WHERE ${party}`,
      [organizationId],
    )
  ).rows[0];
}
export async function legacyShipments(execute: Execute, organizationId: string) {
  const result = await execute(
    `${select} ${from} WHERE ${party} ORDER BY sh.created_at DESC,sh.id DESC LIMIT 1001`,
    [organizationId],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Transport history exceeds the legacy limit. Use the paged transport view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
export async function listShipmentPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) => shipmentPage(execute, req.user!.organizationId, req.query)),
  );
}
export async function summarizeShipments(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => shipmentSummary(execute, req.user!.organizationId)));
}
