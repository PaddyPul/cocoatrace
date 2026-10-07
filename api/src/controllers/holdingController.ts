import { AppError } from '../errors';
import { withCatalogRead } from '../modules/catalog/paging';
import { lockRecallBoundary, assertBatchNotRecalled, activeBatchRecallSql } from '../modules/recall/safety';
import { Request, Response } from 'express';
import { query, getClient } from '../db';
import { recordTradeAudit } from '../modules/trading/transaction';
import { lockHoldingListings, pendingTransferQuantity, reconcileHoldingListings } from '../services/inventoryIntegrity';

export async function getHolding(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT h.*, ${activeBatchRecallSql('h.batch_id')} AS "activeRecall", b.crop, b.harvest_date, b.organic_claim_status, b.grade, b.farm_id, b.source_mode, b.source_name, b.source_country, b.source_region, f.name as farm_name, b.quantity_kg as batch_quantity
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     WHERE h.id = $1 AND h.holder_organization_id = $2`,
    [req.params.id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Holding not found' });
    return;
  }
  const batchRes = await query(
    `SELECT b.*, f.name as farm_name, o.name as holder_name
     FROM harvest_batches b
     LEFT JOIN farms f ON f.id = b.farm_id
     JOIN organizations o ON o.id = b.current_holder_id
     WHERE b.id = $1`,
    [rows[0].batch_id]
  );
  res.json({ holding: rows[0], batch: batchRes.rows[0] || null });
}

export async function listHoldings(req: Request, res: Response): Promise<void> {
  const result = await withCatalogRead(async execute => {
  const { rows } = await execute(
    `SELECT h.*, ${activeBatchRecallSql('h.batch_id')} AS "activeRecall", b.crop, b.harvest_date, b.organic_claim_status, b.grade, b.source_mode, b.source_name, b.source_country, b.source_region, f.name as farm_name
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     WHERE h.holder_organization_id = $1
     ORDER BY h.created_at DESC LIMIT 1001`,
    [req.user!.organizationId]
  );
  if (rows.length > 1000) throw new AppError('Inventory list exceeds the legacy limit. Use the paged inventory view.',422,'CATALOG_READ_LIMIT');
  return rows;
  });
  res.json(result);
}

export async function createHolding(req: Request, res: Response): Promise<void> {
  const { batchId, quantityKg, warehouseLocation } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const batch = (await client.query('SELECT quantity_kg FROM harvest_batches WHERE id=$1 AND current_holder_id=$2 FOR NO KEY UPDATE', [batchId, req.user!.organizationId])).rows[0];
    if (!batch) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Batch not found or not held by your organization' }); return; }
    await assertBatchNotRecalled(client, batchId);
    const allocated = (await client.query("SELECT COALESCE(SUM(quantity_kg),0) AS quantity FROM batch_holdings WHERE batch_id=$1 AND status <> 'transferred'", [batchId])).rows[0];
    const remainingGrams = Math.round(Number(batch.quantity_kg) * 1000) - Math.round(Number(allocated.quantity) * 1000);
    const remaining = remainingGrams / 1000;
    if (Math.round(quantityKg * 1000) > remainingGrams) {
      await client.query('ROLLBACK'); res.status(409).json({ error: `Only ${Math.max(0, remaining)} kg remains unallocated`, code: 'INSUFFICIENT_INVENTORY' }); return;
    }
    const { rows } = await client.query('INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *', [batchId, req.user!.organizationId, quantityKg, warehouseLocation || null]);
    await recordTradeAudit(client, req.user!, 'holding.create', 'batch_holding', rows[0].id);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function transferHolding(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { toOrganizationId, quantityKg, reason } = req.body;
  if (toOrganizationId === req.user!.organizationId) { res.status(400).json({ error: 'Choose a different destination organization' }); return; }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const holding = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 FOR UPDATE', [id, req.user!.organizationId])).rows[0];
    if (!holding) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Holding not found' }); return; }
    await assertBatchNotRecalled(client, holding.batch_id);
    if (holding.status !== 'available') { await client.query('ROLLBACK'); res.status(409).json({ error: 'Committed stock cannot be transferred', code: 'INVENTORY_UNAVAILABLE' }); return; }
    const destination = await client.query('SELECT id FROM organizations WHERE id=$1', [toOrganizationId]);
    if (!destination.rows[0]) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Destination organization not found' }); return; }
    await lockHoldingListings(client, id);
    const reserved = await pendingTransferQuantity(client, id);
    const freeGrams = Math.round(Number(holding.quantity_kg) * 1000) - Math.round(reserved * 1000);
    if (Math.round(quantityKg * 1000) > freeGrams) {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'Requested quantity exceeds free stock', code: 'INSUFFICIENT_INVENTORY' }); return;
    }
    const { rows } = await client.query('INSERT INTO custody_transfers (holding_id,from_organization_id,to_organization_id,quantity_kg) VALUES ($1,$2,$3,$4) RETURNING *', [id, req.user!.organizationId, toOrganizationId, quantityKg]);
    await reconcileHoldingListings(client, id, (freeGrams - Math.round(quantityKg * 1000)) / 1000);
    await recordTradeAudit(client, req.user!, 'custody.transfer.request', 'custody_transfer', rows[0].id, { reason });
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function listTransfers(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT ct.*, o.name as from_org_name, dest.name as to_org_name, h.warehouse_location
     FROM custody_transfers ct
     JOIN organizations o ON o.id = ct.from_organization_id
     JOIN organizations dest ON dest.id = ct.to_organization_id
     JOIN batch_holdings h ON h.id = ct.holding_id
     WHERE ct.to_organization_id=$1 OR ct.from_organization_id=$1
     ORDER BY ct.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function acceptTransfer(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const discovered = (await client.query('SELECT holding_id FROM custody_transfers WHERE id=$1 AND to_organization_id=$2', [id, req.user!.organizationId])).rows[0];
    if (!discovered) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Transfer not found' }); return; }
    const src = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [discovered.holding_id])).rows[0];
    await lockHoldingListings(client, discovered.holding_id);
    const transfer = (await client.query('SELECT * FROM custody_transfers WHERE id=$1 AND to_organization_id=$2 FOR UPDATE', [id, req.user!.organizationId])).rows[0];
    if (!transfer || transfer.status !== 'requested') { await client.query('ROLLBACK'); res.status(409).json({ error: 'Transfer already decided', code: 'TRANSFER_NOT_PENDING' }); return; }
    await assertBatchNotRecalled(client, src.batch_id);
    const qty = Number(transfer.quantity_kg);
    const reserved = await pendingTransferQuantity(client, src.id, id);
    const freeGrams = Math.round(Number(src.quantity_kg) * 1000) - Math.round(reserved * 1000);
    if (src.status !== 'available' || src.holder_organization_id !== transfer.from_organization_id || transfer.to_organization_id === transfer.from_organization_id || !Number.isFinite(qty) || qty <= 0 || Math.round(qty * 1000) > freeGrams) {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'Transfer source no longer has available stock', code: 'INSUFFICIENT_INVENTORY' }); return;
    }
    const newHolding = await client.query('INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *', [src.batch_id, req.user!.organizationId, qty, null]);
    const remainder = (Math.round(Number(src.quantity_kg) * 1000) - Math.round(qty * 1000)) / 1000;
    await client.query("UPDATE batch_holdings SET quantity_kg=$1,status=$2 WHERE id=$3", [remainder === 0 ? Number(src.quantity_kg) : remainder, remainder === 0 ? 'transferred' : 'available', src.id]);
    const updated = await client.query("UPDATE custody_transfers SET status='accepted',responded_at=NOW() WHERE id=$1 RETURNING *", [id]);
    await reconcileHoldingListings(client, src.id, (Math.round(remainder * 1000) - Math.round(reserved * 1000)) / 1000);
    await recordTradeAudit(client, req.user!, 'custody.transfer.accept', 'custody_transfer', id);
    await client.query('COMMIT');
    res.json({ transfer: updated.rows[0], newHolding: newHolding.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function splitHolding(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { quantities } = req.body;
  if (!Array.isArray(quantities) || quantities.length < 2 || quantities.some((qty: unknown) => typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0)) {
    res.status(400).json({ error: 'Provide at least two positive quantities' }); return;
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const holding = (await client.query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 FOR UPDATE', [id, req.user!.organizationId])).rows[0];
    if (!holding) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Holding not found' }); return; }
    await assertBatchNotRecalled(client, holding.batch_id);
    if (holding.status !== 'available' || await pendingTransferQuantity(client, id) > 0) {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'Committed or transfer-reserved stock cannot be split', code: 'INVENTORY_UNAVAILABLE' }); return;
    }
    const total = quantities.reduce((sum: number, qty: number) => sum + qty, 0);
    // Store grams exactly as NUMERIC(12,3), and require exact conservation at that precision.
    const grams = quantities.map((qty: number) => Math.round(qty * 1000));
    if (Math.abs(total - Number(holding.quantity_kg)) > 0.000001 || grams.reduce((sum: number, qty: number) => sum + qty, 0) !== Math.round(Number(holding.quantity_kg) * 1000) || grams.some((qty: number) => qty <= 0)) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Split quantities must conserve the full holding quantity to three decimal places' }); return;
    }
    await lockHoldingListings(client, id);
    await client.query("UPDATE batch_holdings SET status='transferred' WHERE id=$1", [id]);
    await reconcileHoldingListings(client, id, 0);
    const newHoldings: any[] = [];
    for (const qty of grams) {
      const result = await client.query('INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *', [holding.batch_id, req.user!.organizationId, qty / 1000, holding.warehouse_location]);
      newHoldings.push(result.rows[0]);
    }
    await recordTradeAudit(client, req.user!, 'holding.split', 'batch_holding', id);
    await client.query('COMMIT');
    res.json({ original: { ...holding, status: 'transferred' }, newHoldings });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
