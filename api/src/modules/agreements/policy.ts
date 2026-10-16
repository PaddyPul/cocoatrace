import { createHash } from 'node:crypto';
import { z } from 'zod';
export const acceptanceBody = z
  .object({ snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) })
  .strict();
export const scope =
  'Base commercial record only. Payment protection and payment terms are confirmed separately and excluded. This acknowledgement is not a signed legal contract.';
function decimal(value: unknown) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
}
export function commercialSnapshot(row: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    scope,
    contractId: row.id,
    buyerOrganizationId: row.buyer_organization_id,
    sellerOrganizationId: row.seller_organization_id,
    offerId: row.offer_id,
    listingId: row.listing_id,
    holdingId: row.holding_id,
    quantityKg: decimal(row.quantity_kg),
    pricePerKg: decimal(row.price_per_kg),
    currency: row.currency,
    incoterm: row.incoterm,
    origin: row.origin_location,
    destination: row.destination_location,
  };
}
export function snapshotHash(snapshot: unknown) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
