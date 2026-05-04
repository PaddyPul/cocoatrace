const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// CERTIFICATES
// ============================================================

router.get('/certificates', requireAuth, async (req, res) => {
  const { farmId } = req.query;
  let sql = `SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id`;
  const params = [];
  if (farmId) { sql += ' WHERE c.farm_id = $1'; params.push(farmId); }
  sql += ' ORDER BY c.valid_to DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.get('/certificates/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id WHERE c.id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Certificate not found' });
  res.json(rows[0]);
});

router.post('/certificates', requireAuth, requirePermission('certificate.issue'), async (req, res) => {
  const { farmerOrganizationId, farmId, standard = 'EU_ORGANIC', cropScope = ['cocoa'], validFrom, validTo, issuingAuthority, accreditationReference } = req.body;
  const { rows } = await query(
    'INSERT INTO organic_certificates (certifier_organization_id, farmer_organization_id, farm_id, standard, crop_scope, valid_from, valid_to, issuing_authority, accreditation_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [req.user.organizationId, farmerOrganizationId, farmId, standard, cropScope, validFrom, validTo, issuingAuthority, accreditationReference]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'certificate.issue', entityType: 'organic_certificate', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.post('/certificates/:id/:action', requireAuth, requirePermission('certificate.issue'), async (req, res) => {
  const { action } = req.params;
  const validActions = { suspend: 'suspended', revoke: 'revoked', reinstate: 'active' };
  if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });
  const { rows } = await query('UPDATE organic_certificates SET status = $1 WHERE id = $2 AND certifier_organization_id = $3 RETURNING *', [validActions[action], req.params.id, req.user.organizationId]);
  if (!rows[0]) return res.status(404).json({ error: 'Certificate not found or not yours' });
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: `certificate.${action}`, entityType: 'organic_certificate', entityId: req.params.id, reason: req.body.reason });
  res.json(rows[0]);
});

module.exports = router;
