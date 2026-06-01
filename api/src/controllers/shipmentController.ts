import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

const MILESTONE_ORDER = ['requested','accepted','picked_up','warehouse_received','port_received','loaded','departed','arrived','customs_cleared','delivered'];

export async function listShipments(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id, o.name as logistics_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id = sh.contract_id
     LEFT JOIN organizations o ON o.id = sh.logistics_organization_id
     WHERE sh.logistics_organization_id=$1 OR c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY sh.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getShipment(req: Request, res: Response): Promise<void> {
  const shipRes = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id, o.name as logistics_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id = sh.contract_id
     LEFT JOIN organizations o ON o.id=sh.logistics_organization_id
     WHERE sh.id=$1`,
    [req.params.id]
  );
  if (!shipRes.rows[0]) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  const s = shipRes.rows[0];
  if (s.logistics_organization_id !== req.user!.organizationId && s.seller_organization_id !== req.user!.organizationId && s.buyer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const milestoneRes = await query('SELECT * FROM shipment_milestones WHERE shipment_id=$1 ORDER BY recorded_at ASC', [req.params.id]);
  res.json({ shipment: shipRes.rows[0], milestones: milestoneRes.rows });
}

export async function requestShipment(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { logisticsOrganizationId, vesselName, containerReference, originPort, destinationPort, etaArrival } = req.body;
  const contractRes = await query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId]);
  if (!contractRes.rows[0]) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO shipments (contract_id, logistics_organization_id, vessel_name, container_reference, origin_port, destination_port, eta_arrival, current_milestone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [id, logisticsOrganizationId || null, vesselName || null, containerReference || null, originPort, destinationPort, etaArrival || null, 'requested']
  );
  await query("UPDATE sales_contracts SET status='awaiting_shipment' WHERE id=$1", [id]);
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'shipment.request', entityType: 'shipment', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function acceptShipment(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const shipRes = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id
     FROM shipments sh
     JOIN sales_contracts c ON c.id = sh.contract_id
     WHERE sh.id=$1`,
    [id]
  );
  const ship = shipRes.rows[0];
  if (!ship) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  if (ship.logistics_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'This shipment is not assigned to your organization' });
    return;
  }
  if (ship.current_milestone !== 'requested') {
    res.status(400).json({ error: 'Can only accept shipments in requested status' });
    return;
  }

  await query("INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id) VALUES ($1,'accepted',$2)", [id, req.user!.id]);
  await query("UPDATE sales_contracts SET status='awaiting_shipment' WHERE id=$1", [ship.contract_id]);
  const { rows } = await query("UPDATE shipments SET current_milestone='accepted' WHERE id=$1 RETURNING *", [id]);
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'shipment.accept', entityType: 'shipment', entityId: id });
  res.json(rows[0]);
}

export async function recordMilestone(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { milestone, location, notes } = req.body;
  const shipRes = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id
     FROM shipments sh
     JOIN sales_contracts c ON c.id = sh.contract_id
     WHERE sh.id=$1`,
    [id]
  );
  const ship = shipRes.rows[0];
  if (!ship) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  if (ship.logistics_organization_id !== req.user!.organizationId && ship.seller_organization_id !== req.user!.organizationId && ship.buyer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (milestone !== 'exception') {
    const curIdx = MILESTONE_ORDER.indexOf(ship.current_milestone);
    const newIdx = MILESTONE_ORDER.indexOf(milestone);
    if (newIdx <= curIdx) {
      res.status(400).json({ error: `Cannot go from ${ship.current_milestone} to ${milestone}. Milestones must progress forward.` });
      return;
    }
  }

  await query('INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, location, notes) VALUES ($1,$2,$3,$4,$5)', [id, milestone, req.user!.id, location || null, notes || null]);
  if (milestone === 'accepted') await query("UPDATE sales_contracts SET status='awaiting_shipment' WHERE id=$1", [ship.contract_id]);
  if (milestone === 'departed') await query("UPDATE sales_contracts SET status='in_transit' WHERE id=$1", [ship.contract_id]);
  if (milestone === 'delivered') await query("UPDATE sales_contracts SET status='delivered' WHERE id=$1", [ship.contract_id]);

  const updateFields = `current_milestone=$1${milestone === 'delivered' ? ', delivered_at=NOW()' : ''}`;
  const { rows } = await query(`UPDATE shipments SET ${updateFields} WHERE id=$2 RETURNING *`, [milestone, id]);
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: `shipment.milestone.${milestone}`, entityType: 'shipment', entityId: id });
  res.json(rows[0]);
}
