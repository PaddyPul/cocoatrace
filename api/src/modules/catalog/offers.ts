import type { Request, Response } from 'express';
import { config } from '../../config/env';
import { AppError, ValidationError } from '../../errors';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const select = `SELECT t.*, COALESCE(cs.currency_minor_units,CASE WHEN t.currency='JPY' THEN 0 ELSE 2 END) AS currency_minor_units, ROUND(t.quantity_kg*t.offered_price_per_kg,COALESCE(cs.currency_minor_units,CASE WHEN t.currency='JPY' THEN 0 ELSE 2 END)) AS trade_value, $2::int AS platform_fee_rate_bps,ROUND(t.quantity_kg*t.offered_price_per_kg*$2::integer/10000,COALESCE(cs.currency_minor_units,CASE WHEN t.currency='JPY' THEN 0 ELSE 2 END)) AS platform_fee_estimate,'seller' AS platform_fee_payer, l.seller_organization_id, l.origin_location, l.destination_location,
            buyer.name as buyer_name, seller.name as seller_name
`;
const from = `FROM trade_offers t
     LEFT JOIN sales_contracts cs ON cs.offer_id=t.id
     JOIN listings l ON l.id = t.listing_id
     JOIN organizations buyer ON buyer.id = t.buyer_organization_id
     JOIN organizations seller ON seller.id = l.seller_organization_id
`;
const party = '(l.seller_organization_id=$1::uuid OR t.buyer_organization_id=$1::uuid)';
export function offerFilters(parameters: Record<string, unknown>) {
  const direction = text(parameters.direction, 'offer direction', 8) || 'all';
  const status = text(parameters.status, 'offer status', 12) || 'all';
  if (!['all', 'received', 'sent'].includes(direction))
    throw new ValidationError('Invalid offer direction');
  if (!['all', 'pending', 'accepted', 'rejected', 'expired'].includes(status))
    throw new ValidationError('Invalid offer status');
  return { direction, status };
}
export async function offerPage(
  execute: Execute,
  organizationId: string,
  parameters: Record<string, unknown>,
) {
  const filters = offerFilters(parameters);
  const input = parsePage(parameters, ['offers', organizationId, filters], ['direction', 'status']);
  const result = await execute(
    `${select} ${from} WHERE ${party}
    AND ($3::uuid IS NULL OR t.id>$3::uuid)
    AND ($4::text='all' OR ($4::text='received' AND l.seller_organization_id=$1::uuid) OR ($4::text='sent' AND t.buyer_organization_id=$1::uuid))
    AND ($5::text='all' OR t.status=$5::text)
    AND ($6::text='' OR concat_ws(' ',t.id,t.listing_id,buyer.name,seller.name,t.status) ILIKE $7::text ESCAPE '\\')
    ORDER BY t.id LIMIT $8::int`,
    [
      organizationId,
      config.platformFeeBps,
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
export async function offerSummary(execute: Execute, organizationId: string) {
  return (
    await execute(
      `SELECT COUNT(*) FILTER (WHERE l.seller_organization_id=$1::uuid)::int AS received_count,
    COUNT(*) FILTER (WHERE t.buyer_organization_id=$1::uuid)::int AS sent_count,
    COUNT(*) FILTER (WHERE l.seller_organization_id=$1::uuid AND t.status='pending')::int AS received_pending,
    COUNT(*) FILTER (WHERE t.buyer_organization_id=$1::uuid AND t.status='pending')::int AS sent_pending
    FROM trade_offers t JOIN listings l ON l.id=t.listing_id WHERE ${party}`,
      [organizationId],
    )
  ).rows[0];
}
export async function legacyOffers(execute: Execute, organizationId: string) {
  const result = await execute(
    `${select} ${from} WHERE ${party} ORDER BY t.created_at DESC,t.id DESC LIMIT 1001`,
    [organizationId, config.platformFeeBps],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Offer history exceeds the legacy limit. Use the paged offers view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
export async function listOfferPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) => offerPage(execute, req.user!.organizationId, req.query)),
  );
}
export async function summarizeOffers(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => offerSummary(execute, req.user!.organizationId)));
}
