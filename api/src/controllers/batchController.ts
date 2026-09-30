import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';
import { ensureSourceMaterialLot } from '../services/materialLot';
import { hasBatchRelationship, hasExplicitPermission } from '../services/resourcePolicy';

export async function pushToMarketplace(req: Request, res: Response): Promise<void> {
  const batchId = req.params.id as string;
  const { quantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation } = req.body;

  const batchRes = await query('SELECT * FROM harvest_batches WHERE id=$1 AND current_holder_id=$2', [batchId, req.user!.organizationId]);
  if (!batchRes.rows[0]) {
    res.status(404).json({ error: 'Batch not found or not yours' });
    return;
  }
  const batch = batchRes.rows[0];
  if (quantityKg > Number(batch.quantity_kg)) {
    res.status(400).json({ error: `Quantity exceeds batch total of ${batch.quantity_kg} kg` });
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let holdingRes = await client.query(
      'SELECT id FROM batch_holdings WHERE batch_id=$1 AND holder_organization_id=$2 AND status=$3',
      [batchId, req.user!.organizationId, 'available']
    );
    let holdingId: string;
    if (holdingRes.rows[0]) {
      holdingId = holdingRes.rows[0].id;
    } else {
      const newHolding = await client.query(
        'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, status) VALUES ($1,$2,$3,$4) RETURNING id',
        [batchId, req.user!.organizationId, quantityKg, 'available']
      );
      holdingId = newHolding.rows[0].id;
    }

    const availRes = await client.query('SELECT quantity_kg FROM batch_holdings WHERE id=$1', [holdingId]);
    const listedRes = await client.query('SELECT COALESCE(SUM(available_quantity_kg),0) AS listed_quantity FROM listings WHERE holding_id=$1 AND active=TRUE', [holdingId]);
    const remainingQuantity = Number(availRes.rows[0].quantity_kg) - Number(listedRes.rows[0].listed_quantity);
    if (quantityKg > remainingQuantity) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `Only ${remainingQuantity} kg remains available to publish` });
      return;
    }

    const listingRes = await client.query(
      'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user!.organizationId, holdingId, quantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation]
    );

    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'listing.create', entityType: 'listing', entityId: listingRes.rows[0].id });
    res.status(201).json(listingRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listBatches(req: Request, res: Response): Promise<void> {
  const seeAll = hasExplicitPermission(req.user!, 'batch.read.all');
  let sql = `SELECT b.*, f.name as farm_name, o.name as holder_name
             FROM harvest_batches b
             LEFT JOIN farms f ON f.id = b.farm_id
             JOIN organizations o ON o.id = b.current_holder_id`;
  const params: any[] = [];
  if (!seeAll) {
    sql += ` WHERE b.current_holder_id=$1 OR f.farmer_organization_id=$1 OR f.cooperative_organization_id=$1
      OR EXISTS (SELECT 1 FROM batch_holdings h WHERE h.batch_id=b.id AND h.holder_organization_id=$1)
      OR EXISTS (SELECT 1 FROM batch_attestations a WHERE a.batch_id=b.id AND a.certifier_organization_id=$1)
      OR EXISTS (
        SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id
        WHERE h.batch_id=b.id AND (c.seller_organization_id=$1 OR c.buyer_organization_id=$1)
      )`;
    params.push(req.user!.organizationId);
  }
  sql += ' ORDER BY b.harvest_date DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
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
  const evidenceRes = await query(
    `SELECT id,type,file_name,file_size_bytes,mime_type,
            sha256_hash,review_status,linked_entity_type,linked_entity_id,claim_description,created_at
       FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1`,
    [req.params.id],
  );
  res.json({ batch: rows[0], evidence: evidenceRes.rows });
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
  const id = req.params.id as string;
  const { certificateId, notes } = req.body;
  const batchRes = await query('SELECT * FROM harvest_batches WHERE id = $1', [id]);
  const batch = batchRes.rows[0];
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  if (batch.attestation_id) {
    res.status(400).json({ error: 'Batch already attested' });
    return;
  }
  if (batch.source_mode === 'direct_inventory' || !batch.farm_id) {
    res.status(400).json({ error: 'Direct conventional inventory cannot be presented as farm-attested organic supply' });
    return;
  }

  const certRes = await query('SELECT * FROM organic_certificates WHERE id = $1 AND status = $2', [certificateId, 'active']);
  const cert = certRes.rows[0];
  if (!cert) {
    res.status(400).json({ error: 'Certificate not found or not active' });
    return;
  }
  if (cert.certifier_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Certificate not issued by your organization' });
    return;
  }
  if (cert.farm_id !== batch.farm_id) {
    res.status(400).json({ error: 'Certificate does not cover this farm' });
    return;
  }
  const farm = await query('SELECT farmer_organization_id FROM farms WHERE id=$1', [batch.farm_id]);
  if (!farm.rows[0] || cert.farmer_organization_id !== farm.rows[0].farmer_organization_id) {
    res.status(400).json({ error: 'Certificate farmer organization does not match the farm owner' });
    return;
  }
  if (!Array.isArray(cert.crop_scope) || !cert.crop_scope.includes(batch.crop)) {
    res.status(400).json({ error: 'Certificate does not cover this crop' });
    return;
  }

  const harvestDate = new Date(batch.harvest_date);
  if (harvestDate < new Date(cert.valid_from) || harvestDate > new Date(cert.valid_to)) {
    res.status(400).json({ error: 'Harvest date outside certificate validity window' });
    return;
  }

  const provenanceHash = audit.hashObject({ batchId: batch.id, farmId: batch.farm_id, crop: batch.crop, harvestDate: batch.harvest_date, certId: cert.id, attestedAt: new Date().toISOString() });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const attRes = await client.query(
      'INSERT INTO batch_attestations (batch_id, certificate_id, certifier_user_id, certifier_organization_id, provenance_hash, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [batch.id, cert.id, req.user!.id, req.user!.organizationId, provenanceHash, notes || null]
    );
    await client.query(
      "UPDATE harvest_batches SET attestation_id=$1, organic_claim_status='attested', provenance_hash=$2 WHERE id=$3",
      [attRes.rows[0].id, provenanceHash, batch.id]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'batch.attest', entityType: 'harvest_batch', entityId: batch.id, newStateHash: provenanceHash });
    res.status(201).json({ attestation: attRes.rows[0], policyChecks: [
      { rule: 'Certificate active on harvest date', passed: true },
      { rule: 'Certificate covers this farm', passed: true },
      { rule: 'Certifier is issuing organization', passed: true },
    ]});
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
