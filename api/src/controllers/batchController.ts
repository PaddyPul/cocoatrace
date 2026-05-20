import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';

export async function listBatches(req: Request, res: Response): Promise<void> {
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('batch.read');
  let sql = `SELECT b.*, f.name as farm_name, o.name as holder_name
             FROM harvest_batches b
             JOIN farms f ON f.id = b.farm_id
             JOIN organizations o ON o.id = b.current_holder_id`;
  const params: any[] = [];
  if (!seeAll) {
    sql += ' WHERE b.current_holder_id = $1 OR f.farmer_organization_id = $1';
    params.push(req.user!.organizationId);
  }
  sql += ' ORDER BY b.harvest_date DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
}

export async function getBatch(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT b.*, f.name as farm_name, o.name as holder_name,
            a.attested_at, a.provenance_hash as att_hash, a.notes as att_notes,
            c.standard as cert_standard, c.valid_to as cert_valid_to
     FROM harvest_batches b
     JOIN farms f ON f.id = b.farm_id
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
  const evidenceRes = await query("SELECT * FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1", [req.params.id]);
  res.json({ batch: rows[0], evidence: evidenceRes.rows });
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const { farmId, plotIds, crop, harvestDate, quantityKg, moisturePercent, grade } = req.body;
  const { rows } = await query(
    'INSERT INTO harvest_batches (farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, current_holder_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [farmId, plotIds, crop, harvestDate, quantityKg, moisturePercent || null, grade || null, req.user!.organizationId]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'batch.create', entityType: 'harvest_batch', entityId: rows[0].id });
  res.status(201).json(rows[0]);
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
