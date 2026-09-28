import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listEvidence(req: Request, res: Response): Promise<void> {
  const { entityType, entityId } = req.query;
  let sql = 'SELECT * FROM evidence_items WHERE uploader_organization_id=$1';
  const params: any[] = [req.user!.organizationId];
  if (entityType && entityId) {
    sql += ' AND linked_entity_type=$2 AND linked_entity_id=$3';
    params.push(entityType, entityId);
  }
  const { rows } = await query(sql + ' ORDER BY created_at DESC', params);
  res.json(rows);
}

export async function uploadEvidence(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }
  const { type, linkedEntityType, linkedEntityId, claimDescription } = req.body;

  if (linkedEntityType === 'contract') {
    const { rows: contracts } = await query(
      'SELECT id, seller_organization_id, buyer_organization_id FROM sales_contracts WHERE id=$1 AND (seller_organization_id=$2 OR buyer_organization_id=$2)',
      [linkedEntityId, req.user!.organizationId]
    );
    if (!contracts[0]) {
      fs.unlinkSync(req.file.path);
      res.status(403).json({ error: 'Only a party to this contract can add documents' });
      return;
    }
    const sellerDocuments = new Set(['commercial_invoice', 'packing_list', 'quality_certificate', 'inspection_certificate', 'certificate_of_origin', 'insurance_certificate', 'transport_document', 'bill_of_lading', 'export_permit', 'other']);
    const buyerDocuments = new Set(['purchase_order', 'import_permit', 'compliance_document', 'eudr_supporting_document', 'delivery_receipt', 'other']);
    const isSeller = contracts[0].seller_organization_id === req.user!.organizationId;
    const allowedTypes = isSeller ? sellerDocuments : buyerDocuments;
    if (!allowedTypes.has(type)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: `This contract party cannot upload document type: ${type}` });
      return;
    }
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const hash = 'sha256:' + crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const { rows } = await query(
    'INSERT INTO evidence_items (uploader_user_id, uploader_organization_id, type, file_name, file_size_bytes, mime_type, sha256_hash, storage_path, linked_entity_type, linked_entity_id, claim_description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [req.user!.id, req.user!.organizationId, type || 'other', req.file.originalname, req.file.size, req.file.mimetype, hash, req.file.path, linkedEntityType, linkedEntityId, claimDescription || '']
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'evidence.upload', entityType: 'evidence_item', entityId: rows[0].id, newStateHash: hash });
  res.status(201).json(rows[0]);
}

export async function downloadEvidence(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT e.*,
            c.seller_organization_id,
            c.buyer_organization_id
       FROM evidence_items e
       LEFT JOIN sales_contracts c
         ON e.linked_entity_type='contract' AND e.linked_entity_id=c.id
      WHERE e.id=$1`,
    [req.params.id]
  );
  const item = rows[0];
  if (!item) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const organizationId = req.user!.organizationId;
  const allowed = item.uploader_organization_id === organizationId
    || item.seller_organization_id === organizationId
    || item.buyer_organization_id === organizationId;
  if (!allowed) {
    res.status(403).json({ error: 'You do not have access to this document' });
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
