const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

// ============================================================
// AUDIT
// ============================================================

router.get('/audit/events', requireAuth, requirePermission('audit.read'), async (req, res) => {
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

module.exports = router;
