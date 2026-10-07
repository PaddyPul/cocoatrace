import { AppError } from '../errors';
import { withCatalogRead } from '../modules/catalog/paging';
import { lockRecallBoundary, assertBatchNotRecalled, activeBatchRecallSql } from '../modules/recall/safety';
import { loadBatchTrust, legacyOrganicStatus } from '../modules/trust/assessment';
import { Request, Response } from 'express';
import { query, getClient } from '../db';
import { lockHoldingListings, pendingTransferQuantity, reconcileHoldingListings } from '../services/inventoryIntegrity';
import { recordTradeAudit } from '../modules/trading/transaction';

export async function listListings(req: Request, res: Response): Promise<void> {
  const result = await withCatalogRead(async execute => {
  const { rows } = await execute(
    `SELECT l.*, o.name as seller_name, h.batch_id, b.crop, b.organic_claim_status, b.grade, b.harvest_date,
            b.source_mode, b.source_name, b.source_country, b.source_region,
            ${activeBatchRecallSql('b.id')} AS "activeRecall",
            f.name as farm_name, f.region as farm_region, f.country as farm_country
     FROM listings l
     JOIN organizations o ON o.id = l.seller_organization_id
     JOIN batch_holdings h ON h.id = l.holding_id
     JOIN harvest_batches b ON b.id = h.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     WHERE l.active = TRUE AND NOT ${activeBatchRecallSql('b.id')} AND h.status='available' AND h.holder_organization_id=l.seller_organization_id
     ORDER BY l.created_at DESC LIMIT 1001`
  );
  if (rows.length > 1000) throw new AppError('Marketplace list exceeds the legacy limit. Use paged supply search.',422,'CATALOG_READ_LIMIT');
  const trust = await loadBatchTrust(rows.map(row => String(row.batch_id)),execute,true);
  return rows.map(row => ({ ...row, trust: trust.get(String(row.batch_id)), organic_claim_status: legacyOrganicStatus(trust.get(String(row.batch_id))!) }));
  });
  res.json(result);
}

export async function getListing(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT l.*, o.name as seller_name, h.batch_id, b.crop, b.organic_claim_status, b.grade, b.harvest_date,
            b.source_mode, b.source_name, b.source_country, b.source_region,
            ${activeBatchRecallSql('b.id')} AS "activeRecall",
            f.name as farm_name, f.region as farm_region, f.country as farm_country,
            h.batch_id
     FROM listings l
     JOIN organizations o ON o.id = l.seller_organization_id
     JOIN batch_holdings h ON h.id = l.holding_id
     JOIN harvest_batches b ON b.id = h.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     WHERE l.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  const trust = (await loadBatchTrust([rows[0].batch_id])).get(rows[0].batch_id)!;
  res.json({ ...rows[0], trust, organic_claim_status: legacyOrganicStatus(trust) });
}

export async function createListing(req: Request, res: Response): Promise<void> {
  const { holdingId, availableQuantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const holding = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 FOR UPDATE', [holdingId, req.user!.organizationId])).rows[0];
    if (!holding || holding.status !== 'available') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Holding not available', code: 'INVENTORY_UNAVAILABLE' }); return;
    }
    await assertBatchNotRecalled(client, holding.batch_id);
    await lockHoldingListings(client, holdingId);
    const listed = await client.query('SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE', [holdingId]);
    const remainingGrams = Math.round(Number(holding.quantity_kg) * 1000)
      - Math.round(Number(listed.rows[0].quantity) * 1000)
      - Math.round(await pendingTransferQuantity(client, holdingId) * 1000);
    const remaining = remainingGrams / 1000;
    if (Math.round(availableQuantityKg * 1000) > remainingGrams) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: `Only ${Math.max(0, remaining)} kg remains available to publish`, code: 'INSUFFICIENT_INVENTORY' }); return;
    }
    const { rows } = await client.query(
      'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user!.organizationId, holdingId, availableQuantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation]
    );
    await recordTradeAudit(client, req.user!, 'listing.create', 'listing', rows[0].id);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function updateListing(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { pricePerKg, availableQuantityKg, active } = req.body;
  if ((pricePerKg !== undefined && (typeof pricePerKg !== 'number' || !Number.isFinite(pricePerKg) || pricePerKg <= 0)) ||
      (availableQuantityKg !== undefined && (typeof availableQuantityKg !== 'number' || !Number.isFinite(availableQuantityKg) || availableQuantityKg <= 0)) ||
      (active !== undefined && typeof active !== 'boolean')) {
    res.status(400).json({ error: 'Price and quantity must be positive numbers; active must be boolean' }); return;
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const discovered = (await client.query('SELECT holding_id FROM listings WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId])).rows[0];
    if (!discovered) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Listing not found' }); return; }
    const holding = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [discovered.holding_id])).rows[0];
    await lockHoldingListings(client, discovered.holding_id);
    const listing = (await client.query('SELECT * FROM listings WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId])).rows[0];
    // Acceptance may have moved the listing while this request waited for its original holding.
    if (!listing || listing.holding_id !== discovered.holding_id || holding.holder_organization_id !== req.user!.organizationId || holding.status !== 'available') {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'Inventory changed; refresh before editing', code: 'INVENTORY_UNAVAILABLE' }); return;
    }
    const nextActive = active ?? listing.active;
    // Withdrawing recalled stock remains permitted; any continuing publication is blocked.
    if (nextActive) await assertBatchNotRecalled(client, holding.batch_id);
    const nextQuantity = availableQuantityKg ?? Number(listing.available_quantity_kg);
    const sibling = (await client.query('SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE AND id<>$2', [holding.id, id])).rows[0];
    const freeGrams = Math.round(Number(holding.quantity_kg) * 1000)
      - Math.round(Number(sibling.quantity) * 1000)
      - Math.round(await pendingTransferQuantity(client, holding.id) * 1000);
    const free = freeGrams / 1000;
    if (nextActive && Math.round(nextQuantity * 1000) > freeGrams) {
      await client.query('ROLLBACK'); res.status(409).json({ error: `Only ${Math.max(0, free)} kg is available`, code: 'INSUFFICIENT_INVENTORY' }); return;
    }
    const { rows } = await client.query('UPDATE listings SET price_per_kg=COALESCE($1,price_per_kg),available_quantity_kg=$2,active=$3 WHERE id=$4 RETURNING *', [pricePerKg, nextQuantity, nextActive, id]);
    await reconcileHoldingListings(client, holding.id, Number(holding.quantity_kg) - await pendingTransferQuantity(client, holding.id));
    await recordTradeAudit(client, req.user!, 'listing.update', 'listing', id);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function deleteListing(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  // Retain listings referenced by offers/contracts; "delete" withdraws publication.
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const discovered = (await client.query('SELECT holding_id FROM listings WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId])).rows[0];
    if (!discovered) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Listing not found' }); return; }
    const holding = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [discovered.holding_id])).rows[0];
    await lockHoldingListings(client, discovered.holding_id);
    const listing = (await client.query('SELECT * FROM listings WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId])).rows[0];
    if (!listing || listing.holding_id !== discovered.holding_id || holding.status !== 'available' || holding.holder_organization_id !== req.user!.organizationId) {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'Inventory changed; refresh before withdrawing', code: 'INVENTORY_UNAVAILABLE' }); return;
    }
    await client.query('UPDATE listings SET active=FALSE WHERE id=$1', [id]);
    await reconcileHoldingListings(client, holding.id, Number(holding.quantity_kg) - await pendingTransferQuantity(client, holding.id));
    await recordTradeAudit(client, req.user!, 'listing.delete', 'listing', id);
    await client.query('COMMIT');
    res.json({ deleted: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
