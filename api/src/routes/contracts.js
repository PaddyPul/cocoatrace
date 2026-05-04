const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// OFFERS & CONTRACTS
// ============================================================

router.get('/offers', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, l.origin_location, l.destination_location, o.name as buyer_name
     FROM trade_offers t
     JOIN listings l ON l.id = t.listing_id
     JOIN organizations o ON o.id = t.buyer_organization_id
     WHERE l.seller_organization_id=$1 OR t.buyer_organization_id=$1
     ORDER BY t.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.post('/listings/:id/offers', requireAuth, requirePermission('offer.create'), async (req, res) => {
  const { quantityKg, offeredPricePerKg, currency = 'EUR', validUntil } = req.body;
  const listingRes = await query('SELECT * FROM listings WHERE id=$1 AND active=TRUE', [req.params.id]);
  if (!listingRes.rows[0]) return res.status(404).json({ error: 'Listing not found' });
  if (quantityKg > listingRes.rows[0].available_quantity_kg) return res.status(400).json({ error: 'Quantity exceeds listing' });
  const { rows } = await query(
    'INSERT INTO trade_offers (listing_id, buyer_organization_id, quantity_kg, offered_price_per_kg, currency, valid_until) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.params.id, req.user.organizationId, quantityKg, offeredPricePerKg, currency, validUntil || new Date(Date.now() + 7 * 86400000)]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'offer.create', entityType: 'trade_offer', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.post('/offers/:id/accept', requireAuth, requirePermission('offer.respond'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const offRes = await client.query('SELECT o.*, l.holding_id, l.seller_organization_id, l.incoterm FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=$1 AND o.status=$2', [req.params.id, 'pending']);
    const offer = offRes.rows[0];
    if (!offer) return res.status(404).json({ error: 'Offer not found or not pending' });
    if (offer.seller_organization_id !== req.user.organizationId) return res.status(403).json({ error: 'Not your listing' });

    await client.query("UPDATE trade_offers SET status='accepted' WHERE id=$1", [req.params.id]);
    await client.query("UPDATE batch_holdings SET status='committed' WHERE id=$1", [offer.holding_id]);
    await client.query("UPDATE listings SET active=FALSE WHERE id=$1", [offer.listing_id]);

    const contractRes = await client.query(
      'INSERT INTO sales_contracts (listing_id, offer_id, seller_organization_id, buyer_organization_id, holding_id, quantity_kg, price_per_kg, currency, incoterm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [offer.listing_id, offer.id, req.user.organizationId, offer.buyer_organization_id, offer.holding_id, offer.quantity_kg, offer.offered_price_per_kg, offer.currency, offer.incoterm]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'contract.create', entityType: 'sales_contract', entityId: contractRes.rows[0].id });
    res.json({ offer, contract: contractRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/offers/:id/reject', requireAuth, requirePermission('offer.respond'), async (req, res) => {
  const { rows } = await query("UPDATE trade_offers SET status='rejected' WHERE id=$1 RETURNING *", [req.params.id]);
  res.json(rows[0]);
});

router.get('/contracts', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name, h.quantity_kg as holding_qty
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     JOIN batch_holdings h ON h.id = c.holding_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY c.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.get('/contracts/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name,
            ship.id as shipment_id, ship.vessel_name, ship.current_milestone, ship.eta_arrival, ship.container_reference
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     LEFT JOIN shipments ship ON ship.contract_id = c.id
     WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
  res.json(rows[0]);
});

router.patch('/contracts/:id/eudr', requireAuth, async (req, res) => {
  const { eudrDueDiligenceReference } = req.body;
  const { rows } = await query('UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *', [eudrDueDiligenceReference, req.params.id, req.user.organizationId]);
  if (!rows[0]) return res.status(404).json({ error: 'Contract not found or not your contract' });
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'contract.eudr.update', entityType: 'sales_contract', entityId: req.params.id });
  res.json(rows[0]);
});

module.exports = router;
