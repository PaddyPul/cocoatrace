import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

// Includes legacy demo milestones so existing records remain readable.
const MILESTONE_ORDER = [
  'planning', 'booked', 'requested', 'accepted', 'cargo_ready', 'picked_up',
  'warehouse_received', 'handed_over', 'port_received', 'loaded', 'departed',
  'arrived', 'customs_cleared', 'delivered',
];

export async function listShipments(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id,
            coordinator.name as transport_coordinator_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY sh.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getShipment(req: Request, res: Response): Promise<void> {
  const shipRes = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id, c.incoterm,
            seller.name as seller_name, buyer.name as buyer_name,
            coordinator.name as transport_coordinator_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     JOIN organizations seller ON seller.id=c.seller_organization_id
     JOIN organizations buyer ON buyer.id=c.buyer_organization_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     WHERE sh.id=$1`,
    [req.params.id]
  );
  if (!shipRes.rows[0]) {
    res.status(404).json({ error: 'Transport record not found' });
    return;
  }
  const shipment = shipRes.rows[0];
  const organizationId = req.user!.organizationId;
  if (shipment.seller_organization_id !== organizationId && shipment.buyer_organization_id !== organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const milestoneRes = await query(
    `SELECT sm.*, u.name as recorded_by_name, o.name as recorded_by_organization_name
       FROM shipment_milestones sm
       JOIN users u ON u.id=sm.recorded_by_user_id
       JOIN organizations o ON o.id=u.organization_id
      WHERE sm.shipment_id=$1 ORDER BY sm.recorded_at ASC`,
    [req.params.id]
  );
  res.json({ shipment, milestones: milestoneRes.rows });
}

export async function updateShipmentDetails(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const {
    serviceProviderName, bookingReference, transportMode, transportDocumentType,
    transportDocumentReference, trackingUrl, vesselName, containerReference,
    originLocation, destinationLocation, etaArrival,
  } = req.body;
  const { rows } = await query(
    `UPDATE shipments sh SET
       service_provider_name=COALESCE($1, service_provider_name),
       booking_reference=COALESCE($2, booking_reference),
       transport_mode=COALESCE($3, transport_mode),
       transport_document_type=COALESCE($4, transport_document_type),
       transport_document_reference=COALESCE($5, transport_document_reference),
       tracking_url=COALESCE($6, tracking_url),
       vessel_name=COALESCE($7, vessel_name),
       container_reference=COALESCE($8, container_reference),
       origin_port=COALESCE($9, origin_port),
       destination_port=COALESCE($10, destination_port),
       eta_arrival=COALESCE($11, eta_arrival),
       bill_of_lading_number=CASE WHEN $4='bill_of_lading' THEN COALESCE($5, bill_of_lading_number) ELSE bill_of_lading_number END,
       current_milestone=CASE WHEN current_milestone='planning' AND ($1 IS NOT NULL OR $2 IS NOT NULL) THEN 'booked' ELSE current_milestone END
     FROM sales_contracts c
     WHERE sh.id=$12 AND c.id=sh.contract_id
       AND sh.transport_coordinator_organization_id=$13
     RETURNING sh.*`,
    [
      serviceProviderName || null, bookingReference || null, transportMode || null,
      transportDocumentType || null, transportDocumentReference || null, trackingUrl || null,
      vesselName || null, containerReference || null, originLocation || null,
      destinationLocation || null, etaArrival || null, id, req.user!.organizationId,
    ]
  );
  if (!rows[0]) {
    res.status(403).json({ error: 'Only the buyer or seller assigned by the Incoterm can edit the transport arrangement' });
    return;
  }
  if (rows[0].current_milestone === 'booked') {
    await query(
      `INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, notes)
       SELECT $1, 'booked', $2, 'External transport arrangement recorded'
       WHERE NOT EXISTS (SELECT 1 FROM shipment_milestones WHERE shipment_id=$1 AND milestone='booked')`,
      [id, req.user!.id]
    );
    await query("UPDATE sales_contracts SET status='fulfilment_in_progress' WHERE id=$1 AND status='accepted'", [rows[0].contract_id]);
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'transport.arrangement.update', entityType: 'shipment', entityId: id });
  res.json(rows[0]);
}

export async function recordMilestone(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { milestone, location, notes } = req.body;
  const shipRes = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id
       FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id
      WHERE sh.id=$1`,
    [id]
  );
  const shipment = shipRes.rows[0];
  if (!shipment) {
    res.status(404).json({ error: 'Transport record not found' });
    return;
  }
  const organizationId = req.user!.organizationId;
  if (shipment.seller_organization_id !== organizationId && shipment.buyer_organization_id !== organizationId) {
    res.status(403).json({ error: 'Only a party to the contract can report transport progress' });
    return;
  }
  if (!MILESTONE_ORDER.includes(milestone)) {
    res.status(400).json({ error: 'Unknown transport milestone' });
    return;
  }
  const currentIndex = MILESTONE_ORDER.indexOf(shipment.current_milestone);
  const newIndex = MILESTONE_ORDER.indexOf(milestone);
  if (newIndex <= currentIndex) {
    res.status(400).json({ error: `Cannot go from ${shipment.current_milestone} to ${milestone}. Milestones must progress forward.` });
    return;
  }

  await query(
    'INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, location, notes) VALUES ($1,$2,$3,$4,$5)',
    [id, milestone, req.user!.id, location || null, notes || null]
  );
  if (['loaded', 'departed'].includes(milestone)) await query("UPDATE sales_contracts SET status='in_transit' WHERE id=$1", [shipment.contract_id]);
  if (milestone === 'delivered') {
    const payment = await query('SELECT status FROM payment_requests WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 1', [shipment.contract_id]);
    await query('UPDATE sales_contracts SET status=$1 WHERE id=$2', [payment.rows[0]?.status === 'settled' ? 'settled' : 'delivered', shipment.contract_id]);
  }
  const updateFields = `current_milestone=$1${milestone === 'delivered' ? ', delivered_at=NOW()' : ''}`;
  const { rows } = await query(`UPDATE shipments SET ${updateFields} WHERE id=$2 RETURNING *`, [milestone, id]);
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: `transport.milestone.${milestone}`, entityType: 'shipment', entityId: id });
  res.json(rows[0]);
}
