import { PoolClient } from 'pg';

/** All inventory writers lock the holding first, then listings in stable order. */
export async function lockHoldingListings(client: PoolClient, holdingId: string): Promise<void> {
  await client.query('SELECT id FROM listings WHERE holding_id=$1 ORDER BY id FOR UPDATE', [holdingId]);
}

export async function pendingTransferQuantity(client: PoolClient, holdingId: string, exceptId?: string): Promise<number> {
  const result = await client.query(`SELECT COALESCE(SUM(quantity_kg),0) AS quantity FROM custody_transfers
    WHERE holding_id=$1 AND status='requested' AND ($2::uuid IS NULL OR id<>$2)`, [holdingId, exceptId || null]);
  return Number(result.rows[0].quantity);
}

/** Keep published quantities within remaining free stock; stale offers must be decided again. */
export async function reconcileHoldingListings(client: PoolClient, holdingId: string, availableKg: number): Promise<void> {
  const listings = await client.query('SELECT * FROM listings WHERE holding_id=$1 ORDER BY id FOR UPDATE', [holdingId]);
  await client.query(`SELECT o.id FROM trade_offers o JOIN listings l ON l.id=o.listing_id
    WHERE l.holding_id=$1 ORDER BY o.id FOR UPDATE OF o`, [holdingId]);
  let remainingGrams = Math.max(0, Math.round(availableKg * 1000));
  for (const listing of listings.rows) {
    const quantityGrams = Math.round(Number(listing.available_quantity_kg) * 1000);
    const quantity = listing.active ? Math.min(quantityGrams, remainingGrams) / 1000 : quantityGrams / 1000;
    const active = listing.active && quantity > 0;
    if (active) remainingGrams -= Math.round(quantity * 1000);
    await client.query('UPDATE listings SET available_quantity_kg=$1,active=$2 WHERE id=$3', [quantity, active, listing.id]);
    await client.query(`UPDATE trade_offers SET status='rejected' WHERE listing_id=$1 AND status='pending'
      AND ($2::boolean=FALSE OR quantity_kg>$3)`, [listing.id, active, quantity]);
  }
}
