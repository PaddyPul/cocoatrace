import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { QueryResultRow } from 'pg';
import { query } from '../db';
import * as audit from '../services/audit';
import {
  canAccessEvidenceEntity,
  EVIDENCE_ENTITY_TYPES,
  EvidenceEntityType,
  hasExplicitPermission,
} from '../services/resourcePolicy';

const evidenceColumns = `id,type,file_name,file_size_bytes,mime_type,
  sha256_hash,review_status,linked_entity_type,linked_entity_id,claim_description,created_at`;

function isEvidenceEntityType(value: unknown): value is EvidenceEntityType {
  return typeof value === 'string' && (EVIDENCE_ENTITY_TYPES as readonly string[]).includes(value);
}

async function discardUpload(filePath?: string): Promise<void> {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}

export async function listEvidence(req: Request, res: Response): Promise<void> {
  const { entityType, entityId } = req.query;
  if (entityType || entityId) {
    if (!isEvidenceEntityType(entityType) || typeof entityId !== 'string') {
      res.status(400).json({ error: 'A supported entityType and entityId are required together' });
      return;
    }
    if (!await canAccessEvidenceEntity(req.user!, entityType, entityId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const result = await query(
      `SELECT ${evidenceColumns} FROM evidence_items
       WHERE linked_entity_type=$1 AND linked_entity_id=$2 ORDER BY created_at DESC`,
      [entityType, entityId],
    );
    res.json(result.rows);
    return;
  }

  let sql = `SELECT ${evidenceColumns} FROM evidence_items`;
  const params: any[] = [req.user!.organizationId];
  if (!hasExplicitPermission(req.user!, 'evidence.read.all')) sql += ' WHERE uploader_organization_id=$1';
  else params.length = 0;
  const { rows } = await query(sql + ' ORDER BY created_at DESC', params);
  res.json(rows);
}

export async function uploadEvidence(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }
  const { type, linkedEntityType, linkedEntityId, claimDescription } = req.body;

  if (!isEvidenceEntityType(linkedEntityType)
      || !await canAccessEvidenceEntity(req.user!, linkedEntityType, linkedEntityId, null)) {
    await discardUpload(req.file.path);
    res.status(403).json({ error: 'You cannot attach evidence to this resource' });
    return;
  }

  if (linkedEntityType === 'contract') {
    const { rows: contracts } = await query(
      'SELECT id, seller_organization_id, buyer_organization_id FROM sales_contracts WHERE id=$1 AND (seller_organization_id=$2 OR buyer_organization_id=$2)',
      [linkedEntityId, req.user!.organizationId]
    );
    if (!contracts[0]) {
      await discardUpload(req.file.path);
      res.status(403).json({ error: 'Only a party to this contract can add documents' });
      return;
    }
    const sellerDocuments = new Set(['commercial_invoice', 'packing_list', 'quality_certificate', 'inspection_certificate', 'certificate_of_origin', 'insurance_certificate', 'transport_document', 'bill_of_lading', 'export_permit', 'other']);
    const buyerDocuments = new Set(['purchase_order', 'import_permit', 'compliance_document', 'eudr_supporting_document', 'delivery_receipt', 'other']);
    const isSeller = contracts[0].seller_organization_id === req.user!.organizationId;
    const allowedTypes = isSeller ? sellerDocuments : buyerDocuments;
    if (!allowedTypes.has(type)) {
      await discardUpload(req.file.path);
      res.status(400).json({ error: `This contract party cannot upload document type: ${type}` });
      return;
    }
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const hash = 'sha256:' + crypto.createHash('sha256').update(fileBuffer).digest('hex');

  let rows: QueryResultRow[];
  try {
    const result = await query(
      `INSERT INTO evidence_items
        (uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,sha256_hash,
         storage_path,linked_entity_type,linked_entity_id,claim_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${evidenceColumns}`,
      [req.user!.id, req.user!.organizationId, type || 'other', req.file.originalname, req.file.size, req.file.mimetype, hash, req.file.path, linkedEntityType, linkedEntityId, claimDescription || ''],
    );
    rows = result.rows;
  } catch (error) {
    await discardUpload(req.file.path);
    throw error;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'evidence.upload', entityType: 'evidence_item', entityId: rows[0].id, newStateHash: hash });
  res.status(201).json(rows[0]);
}

export async function downloadEvidence(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT e.*,
            c.seller_organization_id,
            c.buyer_organization_id,
            p.release_status
       FROM evidence_items e
       LEFT JOIN sales_contracts c
         ON e.linked_entity_type='contract' AND e.linked_entity_id=c.id
       LEFT JOIN LATERAL (
         SELECT release_status FROM payment_requests
          WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1
       ) p ON TRUE
      WHERE e.id=$1`,
    [req.params.id]
  );
  const item = rows[0];
  if (!item) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const organizationId = req.user!.organizationId;
  const entityAllowed = isEvidenceEntityType(item.linked_entity_type)
    && await canAccessEvidenceEntity(req.user!, item.linked_entity_type, item.linked_entity_id);
  const allowed = item.uploader_organization_id === organizationId || entityAllowed;
  if (!allowed) {
    res.status(403).json({ error: 'You do not have access to this document' });
    return;
  }

  const controlledDocuments = new Set(['transport_document', 'bill_of_lading', 'warehouse_release']);
  if (item.buyer_organization_id === organizationId
      && item.uploader_organization_id !== organizationId
      && controlledDocuments.has(item.type)
      && item.release_status !== 'authorized') {
    res.status(423).json({ error: 'This transport document is protected until the agreed payment release condition is satisfied' });
    return;
  }

  const uploadsRoot = path.resolve(__dirname, '../../uploads');
  const filePath = path.resolve(item.storage_path);
  if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Stored file not found' });
    return;
  }
  res.download(filePath, item.file_name);
}
