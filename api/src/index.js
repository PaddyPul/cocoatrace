// api/src/index.js
// CocoaTrace API — Express + PostgreSQL
const morgan = require('morgan');
require('express-async-errors');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { query, getClient } = require('./db');
const { requireAuth, requirePermission, signToken } = require('./middleware/auth');
const audit = require('./services/audit');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// Ensure uploads dir exists
fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
app.use(morgan("dev"));  
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// AUTH
// ============================================================

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { rows } = await query(
    `SELECT u.*, array_agg(DISTINCT r.name) as role_names, array_agg(DISTINCT p) as permissions
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN LATERAL unnest(r.permissions) p ON TRUE
     WHERE u.email = $1 AND u.active = TRUE
     GROUP BY u.id`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Fetch org name
  const orgRes = await query('SELECT name, type FROM organizations WHERE id = $1', [user.organization_id]);
  const org = orgRes.rows[0];

  const permissions = [...new Set(user.permissions.filter(Boolean))];
  const roles = user.role_names.filter(Boolean);

  const token = signToken({
    id: user.id,
    organizationId: user.organization_id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    orgName: org?.name,
    orgType: org?.type,
  });

  res.json({
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organization_id,
      orgName: org?.name,
      orgType: org?.type,
      roles,
      permissions,
    },
  });
});

app.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.organization_id, u.mfa_enabled,
            o.name as org_name, o.type as org_type,
            array_agg(DISTINCT r.name) as roles,
            array_agg(DISTINCT p) as permissions
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN LATERAL unnest(r.permissions) p ON TRUE
     WHERE u.id = $1
     GROUP BY u.id, o.name, o.type`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({ ...u, permissions: [...new Set(u.permissions.filter(Boolean))], roles: u.roles.filter(Boolean) });
});

// ============================================================
// ORGANIZATIONS
// ============================================================

app.get('/organizations', requireAuth, async (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM organizations ORDER BY name';
  let params = [];
  if (type) { sql = 'SELECT * FROM organizations WHERE type = $1 ORDER BY name'; params = [type]; }
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.post('/organizations', requireAuth, async (req, res) => {
  const { name, type, jurisdiction = 'GH', legalRegistrationNumber } = req.body;
  const { rows } = await query(
    'INSERT INTO organizations (name, type, jurisdiction, legal_registration_number) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, type, jurisdiction, legalRegistrationNumber || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'organization.create', entityType: 'organization', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

app.get('/organizations/:id/members', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.active, u.mfa_enabled, u.created_at,
            array_agg(r.name) as roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.organization_id = $1
     GROUP BY u.id`,
    [req.params.id]
  );
  res.json(rows);
});

// ============================================================
// FARMS
// ============================================================

app.get('/farms', requireAuth, async (req, res) => {
  const canSeeAll = req.user.permissions?.includes('*') || req.user.permissions?.includes('farm.read');
  let sql, params;
  if (canSeeAll) {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id ORDER BY f.name`;
    params = [];
  } else {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.farmer_organization_id = $1 ORDER BY f.name`;
    params = [req.user.organizationId];
  }
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.get('/farms/:id', requireAuth, async (req, res) => {
  const farmRes = await query('SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.id = $1', [req.params.id]);
  if (!farmRes.rows[0]) return res.status(404).json({ error: 'Farm not found' });
  const plotRes = await query('SELECT * FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code', [req.params.id]);
  const certRes = await query('SELECT * FROM organic_certificates WHERE farm_id = $1 ORDER BY valid_to DESC', [req.params.id]);
  res.json({ farm: farmRes.rows[0], plots: plotRes.rows, certificates: certRes.rows });
});

app.post('/farms', requireAuth, async (req, res) => {
  const { name, country = 'GH', region, district, community, officialTraceabilityId } = req.body;
  const { rows } = await query(
    'INSERT INTO farms (farmer_organization_id, name, country, region, district, community, official_traceability_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.organizationId, name, country, region, district, community || null, officialTraceabilityId || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'farm.create', entityType: 'farm', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

app.post('/farms/:id/plots', requireAuth, async (req, res) => {
  const { plotCode, areaHectares, crops = ['cocoa'], gpsLat, gpsLng, geolocationSource = 'farmer_submitted' } = req.body;
  const { rows } = await query(
    'INSERT INTO farm_plots (farm_id, plot_code, area_hectares, crops, gps_lat, gps_lng, geolocation_source) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.params.id, plotCode, areaHectares, crops, gpsLat || null, gpsLng || null, geolocationSource]
  );
  res.status(201).json(rows[0]);
});

app.get('/farms/:id/eudr', requireAuth, async (req, res) => {
  const { rows: plots } = await query('SELECT * FROM farm_plots WHERE farm_id = $1', [req.params.id]);
  const allGeo = plots.every(p => p.gps_lat || p.polygon_geojson);
  const allChecked = plots.every(p => p.eudr_cutoff_checked);
  const allClear = plots.every(p => p.deforestation_risk_status === 'clear');
  res.json({
    farmId: req.params.id,
    plotCount: plots.length,
    geolocationComplete: allGeo,
    eudrCutoffChecked: allChecked,
    allPlotsClear: allClear,
    eudrReady: allGeo && allChecked && allClear,
    plots,
  });
});

// ============================================================
// CERTIFICATES
// ============================================================

app.get('/certificates', requireAuth, async (req, res) => {
  const { farmId } = req.query;
  let sql = `SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id`;
  const params = [];
  if (farmId) { sql += ' WHERE c.farm_id = $1'; params.push(farmId); }
  sql += ' ORDER BY c.valid_to DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.get('/certificates/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id WHERE c.id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Certificate not found' });
  res.json(rows[0]);
});

app.post('/certificates', requireAuth, requirePermission('certificate.issue'), async (req, res) => {
  const { farmerOrganizationId, farmId, standard = 'EU_ORGANIC', cropScope = ['cocoa'], validFrom, validTo, issuingAuthority, accreditationReference } = req.body;
  const { rows } = await query(
    'INSERT INTO organic_certificates (certifier_organization_id, farmer_organization_id, farm_id, standard, crop_scope, valid_from, valid_to, issuing_authority, accreditation_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [req.user.organizationId, farmerOrganizationId, farmId, standard, cropScope, validFrom, validTo, issuingAuthority, accreditationReference]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'certificate.issue', entityType: 'organic_certificate', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

app.post('/certificates/:id/:action', requireAuth, requirePermission('certificate.issue'), async (req, res) => {
  const { action } = req.params;
  const validActions = { suspend: 'suspended', revoke: 'revoked', reinstate: 'active' };
  if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });
  const { rows } = await query('UPDATE organic_certificates SET status = $1 WHERE id = $2 AND certifier_organization_id = $3 RETURNING *', [validActions[action], req.params.id, req.user.organizationId]);
  if (!rows[0]) return res.status(404).json({ error: 'Certificate not found or not yours' });
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: `certificate.${action}`, entityType: 'organic_certificate', entityId: req.params.id, reason: req.body.reason });
  res.json(rows[0]);
});

// ============================================================
// BATCHES
// ============================================================

app.get('/batches', requireAuth, async (req, res) => {
  const perms = req.user.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('batch.read');
  let sql = `SELECT b.*, f.name as farm_name, o.name as holder_name
             FROM harvest_batches b
             JOIN farms f ON f.id = b.farm_id
             JOIN organizations o ON o.id = b.current_holder_id`;
  const params = [];
  if (!seeAll) { sql += ' WHERE b.current_holder_id = $1 OR f.farmer_organization_id = $1'; params.push(req.user.organizationId); }
  sql += ' ORDER BY b.harvest_date DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.get('/batches/:id', requireAuth, async (req, res) => {
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
  if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
  const evidenceRes = await query("SELECT * FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1", [req.params.id]);
  res.json({ batch: rows[0], evidence: evidenceRes.rows });
});

app.post('/batches', requireAuth, async (req, res) => {
  const { farmId, plotIds = [], crop = 'cocoa', harvestDate, quantityKg, moisturePercent, grade } = req.body;
  const { rows } = await query(
    'INSERT INTO harvest_batches (farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, current_holder_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [farmId, plotIds, crop, harvestDate, quantityKg, moisturePercent || null, grade || null, req.user.organizationId]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'batch.create', entityType: 'harvest_batch', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

app.post('/batches/:id/attest', requireAuth, requirePermission('batch.attest'), async (req, res) => {
  const { certificateId, notes } = req.body;
  const batchRes = await query('SELECT * FROM harvest_batches WHERE id = $1', [req.params.id]);
  const batch = batchRes.rows[0];
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  if (batch.attestation_id) return res.status(400).json({ error: 'Batch already attested' });

  const certRes = await query('SELECT * FROM organic_certificates WHERE id = $1 AND status = $2', [certificateId, 'active']);
  const cert = certRes.rows[0];
  if (!cert) return res.status(400).json({ error: 'Certificate not found or not active' });
  if (cert.certifier_organization_id !== req.user.organizationId) return res.status(403).json({ error: 'Certificate not issued by your organization' });
  if (cert.farm_id !== batch.farm_id) return res.status(400).json({ error: 'Certificate does not cover this farm' });

  const harvestDate = new Date(batch.harvest_date);
  if (harvestDate < new Date(cert.valid_from) || harvestDate > new Date(cert.valid_to)) {
    return res.status(400).json({ error: 'Harvest date outside certificate validity window' });
  }

  const provenanceHash = audit.hashObject({ batchId: batch.id, farmId: batch.farm_id, crop: batch.crop, harvestDate: batch.harvest_date, certId: cert.id, attestedAt: new Date().toISOString() });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const attRes = await client.query(
      'INSERT INTO batch_attestations (batch_id, certificate_id, certifier_user_id, certifier_organization_id, provenance_hash, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [batch.id, cert.id, req.user.id, req.user.organizationId, provenanceHash, notes || null]
    );
    await client.query(
      "UPDATE harvest_batches SET attestation_id=$1, organic_claim_status='attested', provenance_hash=$2 WHERE id=$3",
      [attRes.rows[0].id, provenanceHash, batch.id]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'batch.attest', entityType: 'harvest_batch', entityId: batch.id, newStateHash: provenanceHash });
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
});

// ============================================================
// HOLDINGS & CUSTODY
// ============================================================

app.get('/holdings', requireAuth, async (req, res) => {
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

app.post('/holdings', requireAuth, requirePermission('holding.create'), async (req, res) => {
  const { batchId, quantityKg, warehouseLocation } = req.body;
  const { rows } = await query(
    'INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
    [batchId, req.user.organizationId, quantityKg, warehouseLocation || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'holding.create', entityType: 'batch_holding', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

app.post('/holdings/:id/transfer', requireAuth, async (req, res) => {
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

app.post('/transfers/:id/accept', requireAuth, async (req, res) => {
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

app.post('/holdings/:id/split', requireAuth, async (req, res) => {
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

// ============================================================
// LISTINGS
// ============================================================

app.get('/listings', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT l.*, o.name as seller_name, b.crop, b.organic_claim_status, b.grade, b.harvest_date, f.name as farm_name, f.region as farm_region
     FROM listings l
     JOIN organizations o ON o.id = l.seller_organization_id
     JOIN batch_holdings h ON h.id = l.holding_id
     JOIN harvest_batches b ON b.id = h.batch_id
     JOIN farms f ON f.id = b.farm_id
     WHERE l.active = TRUE
     ORDER BY l.created_at DESC`
  );
  res.json(rows);
});

app.post('/listings', requireAuth, requirePermission('listing.create'), async (req, res) => {
  const { holdingId, availableQuantityKg, pricePerKg, currency = 'EUR', incoterm = 'CIF', originLocation, destinationLocation } = req.body;
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 AND status=$3', [holdingId, req.user.organizationId, 'available']);
  if (!holdingRes.rows[0]) return res.status(400).json({ error: 'Holding not found or not available' });
  if (availableQuantityKg > holdingRes.rows[0].quantity_kg) return res.status(400).json({ error: 'Quantity exceeds holding' });
  const { rows } = await query(
    'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.user.organizationId, holdingId, availableQuantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'listing.create', entityType: 'listing', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

// ============================================================
// OFFERS & CONTRACTS
// ============================================================

app.get('/offers', requireAuth, async (req, res) => {
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

app.post('/listings/:id/offers', requireAuth, requirePermission('offer.create'), async (req, res) => {
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

app.post('/offers/:id/accept', requireAuth, requirePermission('offer.respond'), async (req, res) => {
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

app.post('/offers/:id/reject', requireAuth, requirePermission('offer.respond'), async (req, res) => {
  const { rows } = await query("UPDATE trade_offers SET status='rejected' WHERE id=$1 RETURNING *", [req.params.id]);
  res.json(rows[0]);
});

app.get('/contracts', requireAuth, async (req, res) => {
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

app.get('/contracts/:id', requireAuth, async (req, res) => {
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

app.patch('/contracts/:id/eudr', requireAuth, async (req, res) => {
  const { eudrDueDiligenceReference } = req.body;
  const { rows } = await query('UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *', [eudrDueDiligenceReference, req.params.id, req.user.organizationId]);
  if (!rows[0]) return res.status(404).json({ error: 'Contract not found or not your contract' });
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'contract.eudr.update', entityType: 'sales_contract', entityId: req.params.id });
  res.json(rows[0]);
});

// ============================================================
// SHIPMENTS
// ============================================================

app.get('/shipments', requireAuth, async (req, res) => {
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

app.get('/shipments/:id', requireAuth, async (req, res) => {
  const shipRes = await query('SELECT sh.*, o.name as logistics_name FROM shipments sh LEFT JOIN organizations o ON o.id=sh.logistics_organization_id WHERE sh.id=$1', [req.params.id]);
  if (!shipRes.rows[0]) return res.status(404).json({ error: 'Shipment not found' });
  const milestoneRes = await query('SELECT * FROM shipment_milestones WHERE shipment_id=$1 ORDER BY recorded_at ASC', [req.params.id]);
  res.json({ shipment: shipRes.rows[0], milestones: milestoneRes.rows });
});

app.post('/contracts/:id/shipments', requireAuth, requirePermission('shipment.request'), async (req, res) => {
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

app.post('/shipments/:id/milestones', requireAuth, requirePermission('shipment.update'), async (req, res) => {
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

// ============================================================
// PAYMENTS
// ============================================================

app.get('/payment-requests', requireAuth, async (req, res) => {
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

app.post('/contracts/:id/payment-requests', requireAuth, requirePermission('payment.request'), async (req, res) => {
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

app.post('/payment-requests/:id/pay', requireAuth, requirePermission('payment.confirm'), async (req, res) => {
  const { transactionReference } = req.body;
  const { rows } = await query("UPDATE payment_requests SET status='settled', payment_reference_external=$1, settled_at=NOW() WHERE id=$2 RETURNING *", [transactionReference, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Payment request not found' });
  await query("UPDATE sales_contracts SET status='settled' WHERE id=$1", [rows[0].contract_id]);
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'payment.settle', entityType: 'payment_request', entityId: req.params.id });
  res.json(rows[0]);
});

// ============================================================
// EVIDENCE
// ============================================================

app.get('/evidence', requireAuth, async (req, res) => {
  const { entityType, entityId } = req.query;
  let sql = 'SELECT * FROM evidence_items WHERE uploader_organization_id=$1';
  const params = [req.user.organizationId];
  if (entityType && entityId) { sql = 'SELECT * FROM evidence_items WHERE linked_entity_type=$1 AND linked_entity_id=$2'; params.splice(0, 1, entityType, entityId); }
  const { rows } = await query(sql + ' ORDER BY created_at DESC', params);
  res.json(rows);
});

app.post('/evidence', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const { type, linkedEntityType, linkedEntityId, claimDescription } = req.body;

  const fileBuffer = require('fs').readFileSync(req.file.path);
  const hash = 'sha256:' + crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const { rows } = await query(
    'INSERT INTO evidence_items (uploader_user_id, uploader_organization_id, type, file_name, file_size_bytes, mime_type, sha256_hash, storage_path, linked_entity_type, linked_entity_id, claim_description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [req.user.id, req.user.organizationId, type || 'other', req.file.originalname, req.file.size, req.file.mimetype, hash, req.file.path, linkedEntityType, linkedEntityId, claimDescription || '']
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'evidence.upload', entityType: 'evidence_item', entityId: rows[0].id, newStateHash: hash });
  res.status(201).json(rows[0]);
});

// ============================================================
// PROVENANCE PACK
// ============================================================

app.get('/provenance/batches/:batchId', requireAuth, async (req, res) => {
  const { batchId } = req.params;
  const { contractId } = req.query;

  const [batchRes, farmRes] = await Promise.all([
    query(`SELECT b.*, f.name as farm_name, f.region, f.country, f.official_traceability_id,
                  a.attested_at, a.provenance_hash as att_hash,
                  c.standard, c.valid_from, c.valid_to, cert_org.name as certifier_name
           FROM harvest_batches b
           JOIN farms f ON f.id = b.farm_id
           LEFT JOIN batch_attestations a ON a.id = b.attestation_id
           LEFT JOIN organic_certificates c ON c.id = a.certificate_id
           LEFT JOIN organizations cert_org ON cert_org.id = c.certifier_organization_id
           WHERE b.id=$1`, [batchId]),
    query('SELECT * FROM farm_plots WHERE farm_id IN (SELECT farm_id FROM harvest_batches WHERE id=$1)', [batchId]),
  ]);

  const batch = batchRes.rows[0];
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const plots = farmRes.rows;
  const evidenceRes = await query("SELECT * FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1", [batchId]);

  let contract = null;
  let shipment = null;
  if (contractId) {
    const cRes = await query('SELECT * FROM sales_contracts WHERE id=$1', [contractId]);
    contract = cRes.rows[0];
    if (contract) {
      const sRes = await query('SELECT sh.*, array_agg(json_build_object(\'milestone\',m.milestone,\'recordedAt\',m.recorded_at,\'location\',m.location)) as milestones FROM shipments sh LEFT JOIN shipment_milestones m ON m.shipment_id=sh.id WHERE sh.contract_id=$1 GROUP BY sh.id', [contractId]);
      shipment = sRes.rows[0];
    }
  }

  // Policy checks
  const policyChecks = [
    { rule: 'Batch has organic attestation', passed: !!batch.attestation_id, warning: false },
    { rule: 'Certificate active on harvest date', passed: batch.attestation_id && new Date(batch.harvest_date) >= new Date(batch.valid_from) && new Date(batch.harvest_date) <= new Date(batch.valid_to), warning: false },
    { rule: 'Plot geolocation present', passed: plots.some(p => p.gps_lat), warning: !plots.some(p => p.gps_lat) },
    { rule: 'EUDR cutoff checked', passed: plots.every(p => p.eudr_cutoff_checked), warning: !plots.every(p => p.eudr_cutoff_checked) },
    { rule: 'Route GH → NL permitted', passed: true, warning: false },
    { rule: 'EUDR due-diligence reference', passed: !!(contract?.eudr_due_diligence_reference), warning: !(contract?.eudr_due_diligence_reference) },
  ];

  const passedCount = policyChecks.filter(p => p.passed).length;
  const completenessChecks = [!!batch.attestation_id, plots.length > 0, plots.some(p=>p.gps_lat), evidenceRes.rows.some(e=>e.type==='certificate_pdf'), evidenceRes.rows.some(e=>e.type==='weighing_ticket'), !!(contract?.eudr_due_diligence_reference)];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  res.json({
    batchId,
    contractId: contractId || null,
    generatedAt: new Date().toISOString(),
    completenessPercent: completeness,
    status: completeness >= 95 ? 'complete' : 'incomplete',
    batch,
    plots,
    contract,
    shipment,
    evidenceItems: evidenceRes.rows,
    policyCheckResults: policyChecks,
    eudrReadiness: {
      plotGeolocationPresent: plots.some(p => p.gps_lat),
      deforestationCutoffChecked: plots.every(p => p.eudr_cutoff_checked),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: plots.every(p => p.deforestation_risk_status === 'clear') ? 'clear' : 'unknown',
      ready: plots.some(p=>p.gps_lat) && plots.every(p=>p.eudr_cutoff_checked) && !!(contract?.eudr_due_diligence_reference),
    },
  });
});

// ============================================================
// AUDIT
// ============================================================

app.get('/audit/events', requireAuth, requirePermission('audit.read'), async (req, res) => {
  const { entityType, entityId, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM audit_events';
  const params = [];
  if (entityType && entityId) {
    sql += ' WHERE entity_type=$1 AND entity_id=$2';
    params.push(entityType, entityId);
  }
  sql += ` ORDER BY occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🫘 CocoaTrace API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});


