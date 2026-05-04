const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// ORGANIZATIONS
// ============================================================

router.get('/organizations', requireAuth, async (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM organizations ORDER BY name';
  let params = [];
  if (type) { sql = 'SELECT * FROM organizations WHERE type = $1 ORDER BY name'; params = [type]; }
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/organizations', requireAuth, async (req, res) => {
  const { name, type, jurisdiction = 'GH', legalRegistrationNumber } = req.body;
  const { rows } = await query(
    'INSERT INTO organizations (name, type, jurisdiction, legal_registration_number) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, type, jurisdiction, legalRegistrationNumber || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'organization.create', entityType: 'organization', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.get('/organizations/:id/members', requireAuth, async (req, res) => {
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

module.exports = router;
