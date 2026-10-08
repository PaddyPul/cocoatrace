import { batchEvidenceCollection } from '../modules/catalog/evidenceRecords';
import { legacySourceList } from '../modules/catalog/sourceRecords';
import { withCatalogRead } from '../modules/catalog/paging';
import { lockRecallBoundary, assertBatchNotRecalled } from '../modules/recall/safety';
import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';
import { ensureSourceMaterialLot } from '../services/materialLot';
import { lockHoldingListings, pendingTransferQuantity } from '../services/inventoryIntegrity';
import { recordTradeAudit } from '../modules/trading/transaction';
import { hasBatchRelationship, hasExplicitPermission } from '../services/resourcePolicy';
import { loadBatchTrust, legacyOrganicStatus } from '../modules/trust/assessment';
import { attestBatchRecord } from '../modules/trust/certification';

export async function pushToMarketplace(req: Request, res: Response): Promise<void> {
  const batchId = req.params.id as string;
  const { quantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    // Existing stock follows the holding -> listings lock order. A key-share lock
    // protects the source relationship without blocking unrelated batch updates.
    const batch = (await client.query(
      'SELECT * FROM harvest_batches WHERE id=$1 AND current_holder_id=$2 FOR KEY SHARE',
      [batchId, req.user!.organizationId]
    )).rows[0];
    if (!batch) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Batch not found or not yours' });
      return;
    }

    await assertBatchNotRecalled(client, batchId);

    // Prefer the holding with the largest unpublished, unreserved balance. Recheck its budget after locking.
    const holdingRes = await client.query(
      `SELECT h.* FROM batch_holdings h WHERE h.batch_id=$1 AND h.holder_organization_id=$2 AND h.status='available'
       ORDER BY (h.quantity_kg
         - COALESCE((SELECT SUM(l.available_quantity_kg) FROM listings l WHERE l.holding_id=h.id AND l.active=TRUE),0)
         - COALESCE((SELECT SUM(t.quantity_kg) FROM custody_transfers t WHERE t.holding_id=h.id AND t.status='requested'),0)) DESC,h.id
       LIMIT 1 FOR UPDATE OF h`,
      [batchId, req.user!.organizationId]
    );
    let holding = holdingRes.rows[0];
    if (!holding) {
      // Only the allocation path needs the source budget lock. It must not wait
      // for an existing holding after acquiring this lock.
      await client.query('SELECT id FROM harvest_batches WHERE id=$1 FOR NO KEY UPDATE', [batchId]);
      // Reserved and buyer-held inventory still consumes the batch. Never mint it again after a sale.
      const allocated = (await client.query(
        "SELECT COALESCE(SUM(quantity_kg),0) AS quantity FROM batch_holdings WHERE batch_id=$1 AND status<>'transferred'",
        [batchId]
      )).rows[0];
      const unallocatedGrams = Math.round(Number(batch.quantity_kg) * 1000) - Math.round(Number(allocated.quantity) * 1000);
      if (Math.round(quantityKg * 1000) > unallocatedGrams) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'This batch has no unallocated stock available to publish', code: 'INSUFFICIENT_INVENTORY' });
        return;
      }
      holding = (await client.query(
        "INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,status) VALUES ($1,$2,$3,'available') RETURNING *",
        [batchId, req.user!.organizationId, quantityKg]
      )).rows[0];
    }

    await lockHoldingListings(client, holding.id);
    const reserved = await pendingTransferQuantity(client, holding.id);
    const listed = (await client.query(
      'SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE',
      [holding.id]
    )).rows[0];
    const remainingGrams = Math.round(Number(holding.quantity_kg) * 1000)
      - Math.round(reserved * 1000) - Math.round(Number(listed.quantity) * 1000);
    if (Math.round(quantityKg * 1000) > remainingGrams) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: `Only ${Math.max(0, remainingGrams) / 1000} kg remains available to publish`, code: 'INSUFFICIENT_INVENTORY' });
      return;
    }
    const holdingId = holding.id;

    const listingRes = await client.query(
      'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user!.organizationId, holdingId, quantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation]
    );

    await recordTradeAudit(client, req.user!, 'listing.create', 'listing', listingRes.rows[0].id);
    await client.query('COMMIT');
    res.status(201).json(listingRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listBatches(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute=>legacySourceList(execute,req.user!,'batches')));
}

export async function getBatch(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT b.*, f.name as farm_name, f.farmer_organization_id, o.name as holder_name,
            a.attested_at, a.provenance_hash as att_hash, a.notes as att_notes,
            c.standard as cert_standard, c.valid_to as cert_valid_to
     FROM harvest_batches b
     LEFT JOIN farms f ON f.id = b.farm_id
     JOIN organizations o ON o.id = b.current_holder_id
     LEFT JOIN batch_attestations a ON a.id = b.attestation_id
     LEFT JOIN organic_certificates c ON c.id = a.certificate_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  const seeAll = hasExplicitPermission(req.user!, 'batch.read.all');
  if (!seeAll && !await hasBatchRelationship(req.user!, req.params.id)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const evidenceCollection = await withCatalogRead(execute=>batchEvidenceCollection(execute,req.user!,req.params.id as string,req.query.evidenceMode));
  const trust = (await loadBatchTrust([rows[0].id])).get(rows[0].id);
  res.json({ batch: { ...rows[0], recorded_organic_claim_status: rows[0].organic_claim_status, organic_claim_status: trust ? legacyOrganicStatus(trust) : 'self_declared', trust }, ...evidenceCollection });
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const { farmId, plotIds, crop, harvestDate, quantityKg, moisturePercent, grade } = req.body;
  const farm = await query('SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2', [farmId, req.user!.organizationId]);
  if (!farm.rows[0]) {
    res.status(400).json({ error: 'Choose a farm managed by your organization' });
    return;
  }
  if (plotIds?.length) {
    const plots = await query('SELECT id FROM farm_plots WHERE farm_id=$1 AND id=ANY($2::uuid[])', [farmId, plotIds]);
    if (plots.rows.length !== plotIds.length) {
      res.status(400).json({ error: 'One or more plots do not belong to the selected farm' });
      return;
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const { rows } = await client.query(
      "INSERT INTO harvest_batches (farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, current_holder_id, organic_claim_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_attestation') RETURNING *",
      [farmId, plotIds, crop, harvestDate, quantityKg, moisturePercent || null, grade || null, req.user!.organizationId]
    );
    await ensureSourceMaterialLot(client, rows[0]);
    const holding = await client.query(
      "INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, status) VALUES ($1,$2,$3,'available') RETURNING id",
      [rows[0].id, req.user!.organizationId, quantityKg]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'batch.create', entityType: 'harvest_batch', entityId: rows[0].id });
    res.status(201).json({ ...rows[0], holding_id: holding.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createDirectInventory(req: Request, res: Response): Promise<void> {
  const { commodity, quantityKg, inventoryDate, sourceName, sourceCountry, sourceRegion, warehouseLocation, moisturePercent, grade } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const batch = await client.query(
      `INSERT INTO harvest_batches (
        farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade,
        current_holder_id, organic_claim_status, source_mode, source_name, source_country, source_region
      ) VALUES (NULL,'{}',$1,$2,$3,$4,$5,$6,'none','direct_inventory',$7,$8,$9) RETURNING *`,
      [commodity, inventoryDate, quantityKg, moisturePercent || null, grade || null, req.user!.organizationId, sourceName || null, sourceCountry, sourceRegion || null]
    );
    await ensureSourceMaterialLot(client, batch.rows[0]);
    const holding = await client.query(
      "INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location, status) VALUES ($1,$2,$3,$4,'available') RETURNING *",
      [batch.rows[0].id, req.user!.organizationId, quantityKg, warehouseLocation || null]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'inventory.create_direct', entityType: 'harvest_batch', entityId: batch.rows[0].id });
    res.status(201).json({ ...batch.rows[0], holding_id: holding.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function attestBatch(req: Request, res: Response): Promise<void> {
  res.status(201).json(await attestBatchRecord(req.user!, req.params.id as string, req.body));
}
