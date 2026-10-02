import { PoolClient, QueryResultRow } from 'pg';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { lockHoldingListings, pendingTransferQuantity, reconcileHoldingListings } from '../../services/inventoryIntegrity';
import { createFulfillment } from './fulfillment';
import { inTradeTransaction, recordTradeAudit, TradeActor } from './transaction';

/** Discovery takes no locks. Every mutable inventory path locks holding -> listings -> offers. */
async function lockOfferInventory(client: PoolClient, offerId: string) {
  const found = await client.query(`SELECT l.holding_id FROM trade_offers o
    JOIN listings l ON l.id=o.listing_id WHERE o.id=$1`, [offerId]);
  if (!found.rows[0]) throw new NotFoundError('Offer');
  const holdingId = found.rows[0].holding_id;
  const holding = await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [holdingId]);
  if (!holding.rows[0]) throw new NotFoundError('Inventory');
  await lockHoldingListings(client, holdingId);
  await client.query(`SELECT o.id FROM trade_offers o JOIN listings l ON l.id=o.listing_id
    WHERE l.holding_id=$1 ORDER BY o.id FOR UPDATE OF o`, [holdingId]);
  const result = await client.query(`SELECT o.*, l.holding_id, l.seller_organization_id,l.active,
    l.available_quantity_kg,l.price_per_kg AS listing_price_per_kg,l.currency AS listing_currency,
    l.incoterm,l.origin_location,l.destination_location,
    o.valid_until>clock_timestamp() AS valid_now
    FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=$1`, [offerId]);
  const offer = result.rows[0];
  // A concurrent acceptance may have moved this listing onto its committed slice.
  if (!offer || offer.holding_id !== holdingId) throw new ConflictError('Offer inventory has changed; refresh the deal');
  return { offer, holding: holding.rows[0] };
}

function requireSeller(actor: TradeActor, offer: QueryResultRow, holding: QueryResultRow): void {
  if (offer.seller_organization_id !== actor.organizationId || holding.holder_organization_id !== actor.organizationId) {
    throw new ForbiddenError('Not your listing');
  }
}

export async function acceptTradeOffer(actor: TradeActor, offerId: string) {
  return inTradeTransaction(async (client) => {
    const { offer, holding } = await lockOfferInventory(client, offerId);
    requireSeller(actor, offer, holding);
    if (offer.status !== 'pending') throw new ConflictError('Offer is no longer pending');
    if (!offer.valid_now) throw new AppError('Offer has expired; request a new offer', 409, 'OFFER_EXPIRED');
    if (!offer.active || holding.status !== 'available') throw new ConflictError('Supply is no longer available');
    if (offer.buyer_organization_id === actor.organizationId) throw new ConflictError('A seller cannot accept its own offer');
    const quantity = Number(offer.quantity_kg);
    const reserved = await pendingTransferQuantity(client, holding.id);
    const freeGrams = Math.round(Number(holding.quantity_kg) * 1000) - Math.round(reserved * 1000);
    if (!(quantity > 0) || quantity > Number(offer.available_quantity_kg) || Math.round(quantity * 1000) > freeGrams) {
      throw new AppError('Quantity exceeds currently available inventory', 409, 'INVENTORY_UNAVAILABLE');
    }
    const existing = await client.query('SELECT id FROM sales_contracts WHERE offer_id=$1', [offerId]);
    if (existing.rows[0]) throw new ConflictError('This offer already has a contract');
    // Integer grams avoid residual floating-point drift for NUMERIC(12,3) stock.
    const residual = (Math.round(Number(holding.quantity_kg) * 1000) - Math.round(quantity * 1000)) / 1000;
    let committedHoldingId = holding.id;
    if (residual > 0) {
      const committed = await client.query(`INSERT INTO batch_holdings
        (batch_id,holder_organization_id,quantity_kg,warehouse_location,status)
        VALUES($1,$2,$3,$4,'committed') RETURNING id`,
      [holding.batch_id, actor.organizationId, quantity, holding.warehouse_location]);
      committedHoldingId = committed.rows[0].id;
      await client.query('UPDATE batch_holdings SET quantity_kg=$1 WHERE id=$2', [residual, holding.id]);
    } else {
      await client.query("UPDATE batch_holdings SET status='committed' WHERE id=$1", [holding.id]);
    }
    const accepted = await client.query("UPDATE trade_offers SET status='accepted' WHERE id=$1 RETURNING *", [offerId]);
    await client.query(`UPDATE listings SET active=FALSE,holding_id=$1,available_quantity_kg=$2 WHERE id=$3`,
      [committedHoldingId, quantity, offer.listing_id]);
    await client.query("UPDATE trade_offers SET status='rejected' WHERE listing_id=$1 AND id<>$2 AND status='pending'", [offer.listing_id, offerId]);
    // The accepted listing is immutable deal history on the committed slice.
    // Continue publishing only its unsold advertised stock, reserving that budget
    // before resizing sibling listings (including legacy overpublished inventory).
    const remainingListingGrams = Math.max(0, Math.min(
      Math.round(Number(offer.available_quantity_kg) * 1000) - Math.round(quantity * 1000),
      Math.round(residual * 1000) - Math.round(reserved * 1000),
    ));
    await reconcileHoldingListings(client, holding.id,
      (Math.round(residual * 1000) - Math.round(reserved * 1000) - remainingListingGrams) / 1000);
    let remainingListing: QueryResultRow | null = null;
    if (remainingListingGrams > 0) {
      const continuation = await client.query(`INSERT INTO listings
        (seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [actor.organizationId, holding.id, remainingListingGrams / 1000,
        offer.listing_price_per_kg, offer.listing_currency, offer.incoterm,
        offer.origin_location, offer.destination_location]);
      const publishedRemainder: QueryResultRow = continuation.rows[0];
      remainingListing = publishedRemainder;
      await recordTradeAudit(client, actor, 'listing.continue', 'listing', publishedRemainder.id, {
        acceptedListingId: offer.listing_id, offerId, quantityKg: remainingListingGrams / 1000,
      });
    }
    const fulfillment = await createFulfillment(client, actor, offer, committedHoldingId);
    await recordTradeAudit(client, actor, 'offer.accept', 'trade_offer', offerId, {
      sourceHoldingId: holding.id, committedHoldingId, quantityKg: quantity, residualQuantityKg: residual,
    });
    return { offer: accepted.rows[0], remainingListing, ...fulfillment };
  });
}

interface OfferInput { quantityKg: number; offeredPricePerKg: number; currency: string; validUntil?: string }

export async function createTradeOffer(actor: TradeActor, listingId: string, input: OfferInput) {
  const deadline = input.validUntil ? new Date(input.validUntil) : new Date(Date.now() + 7 * 86400000);
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) throw new ValidationError('Offer expiry must be in the future');
  const grams = input.quantityKg * 1000;
  if (!Number.isFinite(grams) || grams < 1 || Math.abs(grams - Math.round(grams)) > 0.000001) {
    throw new ValidationError('Offer quantity must use at most three decimal places');
  }
  return inTradeTransaction(async (client) => {
    const found = await client.query('SELECT holding_id FROM listings WHERE id=$1', [listingId]);
    if (!found.rows[0]) throw new NotFoundError('Listing');
    const holdingId = found.rows[0].holding_id;
    const result = await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [holdingId]);
    await lockHoldingListings(client, holdingId);
    const listingRes = await client.query('SELECT * FROM listings WHERE id=$1', [listingId]);
    const listing = listingRes.rows[0], holding = result.rows[0];
    if (!listing || listing.holding_id !== holdingId || !listing.active || !holding || holding.status !== 'available') {
      throw new ConflictError('Supply is no longer available');
    }
    if (listing.seller_organization_id === actor.organizationId) throw new ValidationError('You cannot make an offer on your own supply');
    if (listing.seller_organization_id !== holding.holder_organization_id) throw new ConflictError('Supply ownership has changed');
    const freeGrams = Math.round(Number(holding.quantity_kg) * 1000)
      - Math.round(await pendingTransferQuantity(client, holdingId) * 1000);
    if (input.quantityKg > Number(listing.available_quantity_kg) || Math.round(input.quantityKg * 1000) > freeGrams) {
      throw new AppError('Quantity exceeds currently available inventory', 409, 'INVENTORY_UNAVAILABLE');
    }
    const offered = await client.query(`INSERT INTO trade_offers
      (listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [listingId, actor.organizationId, input.quantityKg, input.offeredPricePerKg, input.currency, deadline]);
    await recordTradeAudit(client, actor, 'offer.create', 'trade_offer', offered.rows[0].id);
    return offered.rows[0];
  });
}

export async function rejectTradeOffer(actor: TradeActor, offerId: string) {
  return inTradeTransaction(async (client) => {
    const { offer, holding } = await lockOfferInventory(client, offerId);
    requireSeller(actor, offer, holding);
    if (offer.status !== 'pending') throw new ConflictError('Offer is no longer pending');
    const result = await client.query("UPDATE trade_offers SET status='rejected' WHERE id=$1 RETURNING *", [offerId]);
    await recordTradeAudit(client, actor, 'offer.reject', 'trade_offer', offerId);
    return result.rows[0];
  });
}
