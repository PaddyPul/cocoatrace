const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const audit = require('../services/audit');

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

// ============================================================
// EVIDENCE
// ============================================================

router.get('/evidence', requireAuth, async (req, res) => {
  const { entityType, entityId } = req.query;
  let sql = 'SELECT * FROM evidence_items WHERE uploader_organization_id=$1';
  const params = [req.user.organizationId];
  if (entityType && entityId) { sql = 'SELECT * FROM evidence_items WHERE linked_entity_type=$1 AND linked_entity_id=$2'; params.splice(0, 1, entityType, entityId); }
  const { rows } = await query(sql + ' ORDER BY created_at DESC', params);
  res.json(rows);
});

router.post('/evidence', requireAuth, upload.single('file'), async (req, res) => {
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

module.exports = router;
