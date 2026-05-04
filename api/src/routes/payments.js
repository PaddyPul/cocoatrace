const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// PAYMENTS
// ============================================================

router.get('/payment-requests', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, c.seller_organization_id, c.buyer_organization_id
     FROM payment_requests p
     JOIN sales_contracts c ON c.id = p.contract_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY p.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.post('/contracts/:id/payment-requests', requireAuth, requirePermission('payment.request'), async (req, res) => {
  const { amountTotal, currency = 'EUR' } = req.body;
  const contractRes = await query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2', [req.params.id, req.user.organizationId]);
  if (!contractRes.rows[0]) return res.status(404).json({ error: 'Contract not found' });
  const { rows } = await query(
    'INSERT INTO payment_requests (contract_id, requested_by_organization_id, amount_total, currency) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user.organizationId, amountTotal, currency]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'payment.request', entityType: 'payment_request', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.post('/payment-requests/:id/pay', requireAuth, requirePermission('payment.confirm'), async (req, res) => {
  const { transactionReference } = req.body;
  const { rows } = await query("UPDATE payment_requests SET status='settled', payment_reference_external=$1, settled_at=NOW() WHERE id=$2 RETURNING *", [transactionReference, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Payment request not found' });
  await query("UPDATE sales_contracts SET status='settled' WHERE id=$1", [rows[0].contract_id]);
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'payment.settle', entityType: 'payment_request', entityId: req.params.id });
  res.json(rows[0]);
});

module.exports = router;
