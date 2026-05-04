const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// HOLDINGS & CUSTODY
// ============================================================

router.get('/holdings', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT h.*, b.crop, b.harvest_date, b.organic_claim_status, b.grade, f.name as farm_name
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     JOIN farms f ON f.id = b.farm_id
     WHERE h.holder_organization_id = $1
     ORDER BY h.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.post('/holdings', requireAuth, requirePermission('holding.create'), async (req, res) => {
  const { batchId, quantityKg, warehouseLocation } = req.body;
  const { rows } = await query(
    'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
    [batchId, req.user.organizationId, quantityKg, warehouseLocation || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'holding.create', entityType: 'batch_holding', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.post('/holdings/:id/transfer', requireAuth, async (req, res) => {
  const { toOrganizationId, quantityKg, reason } = req.body;
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2', [req.params.id, req.user.organizationId]);
  const holding = holdingRes.rows[0];
  if (!holding) return res.status(404).json({ error: 'Holding not found or not yours' });
  if (quantityKg > holding.quantity_kg) return res.status(400).json({ error: `Only ${holding.quantity_kg} kg available` });

  const { rows } = await query(
    'INSERT INTO custody_transfers (holding_id, from_organization_id, to_organization_id, quantity_kg) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user.organizationId, toOrganizationId, quantityKg]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'custody.transfer.request', entityType: 'custody_transfer', entityId: rows[0].id, reason });
  res.status(201).json(rows[0]);
});

router.post('/transfers/:id/accept', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const tRes = await client.query('SELECT * FROM custody_transfers WHERE id=$1 AND to_organization_id=$2 AND status=$3', [req.params.id, req.user.organizationId, 'requested']);
    const transfer = tRes.rows[0];
    if (!transfer) return res.status(404).json({ error: 'Transfer not found or not for your org' });

    const srcRes = await client.query('SELECT * FROM batch_holdings WHERE id=$1', [transfer.holding_id]);
    const src = srcRes.rows[0];

    const newHolding = await client.query(
      'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
      [src.batch_id, req.user.organizationId, transfer.quantity_kg, null]
    );
    await client.query('UPDATE batch_holdings SET quantity_kg = quantity_kg - $1 WHERE id=$2', [transfer.quantity_kg, src.id]);
    await client.query("UPDATE custody_transfers SET status='accepted', responded_at=NOW() WHERE id=$1", [req.params.id]);
    await client.query('UPDATE harvest_batches SET current_holder_id=$1 WHERE id=$2', [req.user.organizationId, src.batch_id]);
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'custody.transfer.accept', entityType: 'custody_transfer', entityId: req.params.id });
    res.json({ transfer, newHolding: newHolding.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/holdings/:id/split', requireAuth, async (req, res) => {
  const { quantities } = req.body;
  if (!Array.isArray(quantities) || quantities.length < 2) return res.status(400).json({ error: 'Provide at least 2 quantities' });
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 AND status=$3', [req.params.id, req.user.organizationId, 'available']);
  const holding = holdingRes.rows[0];
  if (!holding) return res.status(404).json({ error: 'Holding not found' });
  const total = quantities.reduce((a, b) => a + Number(b), 0);
  if (Math.abs(total - holding.quantity_kg) > 0.01) return res.status(400).json({ error: `Quantities sum to ${total} but holding is ${holding.quantity_kg} kg` });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE batch_holdings SET status='transferred' WHERE id=$1", [holding.id]);
    const newHoldings = [];
    for (const qty of quantities) {
      const r = await client.query('INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *', [holding.batch_id, req.user.organizationId, qty, holding.warehouse_location]);
      newHoldings.push(r.rows[0]);
    }
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'holding.split', entityType: 'batch_holding', entityId: holding.id });
    res.json({ original: holding, newHoldings });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
