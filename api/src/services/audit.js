// api/src/services/audit.js
const { query } = require('../db');
const crypto = require('crypto');

function hashObject(obj) {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

async function record({ actorUserId, actorOrganizationId, action, entityType, entityId, newStateHash, reason, metadata }) {
  try {
    await query(
      `INSERT INTO audit_events (actor_user_id, actor_organization_id, action, entity_type, entity_id, new_state_hash, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [actorUserId, actorOrganizationId, action, entityType, entityId,
       newStateHash || hashObject({ entityId, action, at: new Date().toISOString() }),
       reason || null, JSON.stringify(metadata || {})]
    );
  } catch (err) {
    // Audit failures should not block the main action
    console.error('Audit record failed:', err.message);
  }
}

module.exports = { record, hashObject };
