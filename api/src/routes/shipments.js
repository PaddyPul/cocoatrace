const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// SHIPMENTS
// ============================================================

router.get('/shipments', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT sh.*, c.seller_organization_id, c.buyer_organization_id, o.name as logistics_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id = sh.contract_id
     LEFT JOIN organizations o ON o.id = sh.logistics_organization_id
     WHERE sh.logistics_organization_id=$1 OR c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY sh.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.get('/shipments/:id', requireAuth, async (req, res) => {
  const shipRes = await query('SELECT sh.*, o.name as logistics_name FROM shipments sh LEFT JOIN organizations o ON o.id=sh.logistics_organization_id WHERE sh.id=$1', [req.params.id]);
  if (!shipRes.rows[0]) return res.status(404).json({ error: 'Shipment not found' });
  const milestoneRes = await query('SELECT * FROM shipment_milestones WHERE shipment_id=$1 ORDER BY recorded_at ASC', [req.params.id]);
  res.json({ shipment: shipRes.rows[0], milestones: milestoneRes.rows });
});

router.post('/contracts/:id/shipments', requireAuth, requirePermission('shipment.request'), async (req, res) => {
  const { logisticsOrganizationId, vesselName, containerReference, originPort, destinationPort, etaArrival } = req.body;
  const contractRes = await query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2', [req.params.id, req.user.organizationId]);
  if (!contractRes.rows[0]) return res.status(404).json({ error: 'Contract not found' });
  const { rows } = await query(
    'INSERT INTO shipments (contract_id, logistics_organization_id, vessel_name, container_reference, origin_port, destination_port, eta_arrival, current_milestone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.params.id, logisticsOrganizationId || null, vesselName || null, containerReference || null, originPort || 'Tema Port, Ghana', destinationPort || 'Port of Rotterdam, Netherlands', etaArrival || null, 'requested']
  );
  await query("UPDATE sales_contracts SET status='awaiting_shipment' WHERE id=$1", [req.params.id]);
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'shipment.request', entityType: 'shipment', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

const MILESTONE_ORDER = ['requested','accepted','picked_up','warehouse_received','port_received','loaded','departed','arrived','customs_cleared','delivered'];

router.post('/shipments/:id/milestones', requireAuth, requirePermission('shipment.update'), async (req, res) => {
  const { milestone, location, notes } = req.body;
  const shipRes = await query('SELECT * FROM shipments WHERE id=$1', [req.params.id]);
  const ship = shipRes.rows[0];
  if (!ship) return res.status(404).json({ error: 'Shipment not found' });

  if (milestone !== 'exception') {
    const curIdx = MILESTONE_ORDER.indexOf(ship.current_milestone);
    const newIdx = MILESTONE_ORDER.indexOf(milestone);
    if (newIdx <= curIdx) return res.status(400).json({ error: `Cannot go from ${ship.current_milestone} to ${milestone}. Milestones must progress forward.` });
  }

  await query('INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, location, notes) VALUES ($1,$2,$3,$4,$5)', [req.params.id, milestone, req.user.id, location || null, notes || null]);
  const updates = { current_milestone: milestone };
  if (milestone === 'delivered') updates.delivered_at = new Date();
  if (milestone === 'accepted') await query("UPDATE sales_contracts SET status='awaiting_shipment' WHERE id=$1", [ship.contract_id]);
  if (milestone === 'departed') await query("UPDATE sales_contracts SET status='in_transit' WHERE id=$1", [ship.contract_id]);
  if (milestone === 'delivered') await query("UPDATE sales_contracts SET status='delivered' WHERE id=$1", [ship.contract_id]);

  const { rows } = await query(`UPDATE shipments SET current_milestone=$1 ${milestone === 'delivered' ? ', delivered_at=NOW()' : ''} WHERE id=$2 RETURNING *`, [milestone, req.params.id]);
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: `shipment.milestone.${milestone}`, entityType: 'shipment', entityId: req.params.id });
  res.json(rows[0]);
});

module.exports = router;
