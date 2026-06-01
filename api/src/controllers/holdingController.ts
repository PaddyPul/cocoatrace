import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';

export async function getHolding(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT h.*, b.crop, b.harvest_date, b.organic_claim_status, b.grade, b.farm_id, f.name as farm_name, b.quantity_kg as batch_quantity
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     JOIN farms f ON f.id = b.farm_id
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
     JOIN farms f ON f.id = b.farm_id
     JOIN organizations o ON o.id = b.current_holder_id
     WHERE b.id = $1`,
    [rows[0].batch_id]
  );
  res.json({ holding: rows[0], batch: batchRes.rows[0] || null });
}

export async function listHoldings(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT h.*, b.crop, b.harvest_date, b.organic_claim_status, b.grade, f.name as farm_name
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     JOIN farms f ON f.id = b.farm_id
     WHERE h.holder_organization_id = $1
     ORDER BY h.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function createHolding(req: Request, res: Response): Promise<void> {
  const { batchId, quantityKg, warehouseLocation } = req.body;
  const { rows } = await query(
    'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
    [batchId, req.user!.organizationId, quantityKg, warehouseLocation || null]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'holding.create', entityType: 'batch_holding', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function transferHolding(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { toOrganizationId, quantityKg, reason } = req.body;
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2', [id, req.user!.organizationId]);
  const holding = holdingRes.rows[0];
  if (!holding) {
    res.status(404).json({ error: 'Holding not found or not yours' });
    return;
  }
  if (quantityKg > holding.quantity_kg) {
    res.status(400).json({ error: `Only ${holding.quantity_kg} kg available` });
    return;
  }

  const { rows } = await query(
    'INSERT INTO custody_transfers (holding_id, from_organization_id, to_organization_id, quantity_kg) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, req.user!.organizationId, toOrganizationId, quantityKg]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'custody.transfer.request', entityType: 'custody_transfer', entityId: rows[0].id, reason });
  res.status(201).json(rows[0]);
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
    const tRes = await client.query('SELECT * FROM custody_transfers WHERE id=$1 AND to_organization_id=$2 AND status=$3', [id, req.user!.organizationId, 'requested']);
    const transfer = tRes.rows[0];
    if (!transfer) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Transfer not found or not for your org' });
      return;
    }

    const srcRes = await client.query('SELECT * FROM batch_holdings WHERE id=$1', [transfer.holding_id]);
    const src = srcRes.rows[0];

    const newHolding = await client.query(
      'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
      [src.batch_id, req.user!.organizationId, transfer.quantity_kg, null]
    );
    await client.query('UPDATE batch_holdings SET quantity_kg = quantity_kg - $1 WHERE id=$2', [transfer.quantity_kg, src.id]);
    await client.query("UPDATE custody_transfers SET status='accepted', responded_at=NOW() WHERE id=$1", [id]);
    if (Number(transfer.quantity_kg) >= Number(src.quantity_kg)) {
      await client.query('UPDATE harvest_batches SET current_holder_id=$1 WHERE id=$2', [req.user!.organizationId, src.batch_id]);
    }
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'custody.transfer.accept', entityType: 'custody_transfer', entityId: id });
    res.json({ transfer, newHolding: newHolding.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function splitHolding(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { quantities } = req.body;
  if (!Array.isArray(quantities) || quantities.length < 2) {
    res.status(400).json({ error: 'Provide at least 2 quantities' });
    return;
  }
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 AND status=$3', [id, req.user!.organizationId, 'available']);
  const holding = holdingRes.rows[0];
  if (!holding) {
    res.status(404).json({ error: 'Holding not found' });
    return;
  }
  const total = quantities.reduce((a: number, b: number) => a + Number(b), 0);
  if (Math.abs(total - holding.quantity_kg) > 0.01) {
    res.status(400).json({ error: `Quantities sum to ${total} but holding is ${holding.quantity_kg} kg` });
    return;
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE batch_holdings SET status='transferred' WHERE id=$1", [holding.id]);
    const newHoldings: any[] = [];
    for (const qty of quantities) {
      const r = await client.query('INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *', [holding.batch_id, req.user!.organizationId, qty, holding.warehouse_location]);
      newHoldings.push(r.rows[0]);
    }
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'holding.split', entityType: 'batch_holding', entityId: holding.id });
    res.json({ original: holding, newHoldings });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
