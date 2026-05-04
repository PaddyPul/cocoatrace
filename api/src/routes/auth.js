const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');

// ============================================================
// AUTH
// ============================================================

router.post('/auth/login', async (req, res) => {
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

router.get('/me', requireAuth, async (req, res) => {
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

module.exports = router;
