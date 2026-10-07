import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db';
import {
  canAccessEvidenceEntity,
  EVIDENCE_ENTITY_TYPES,
  EvidenceEntityType,
} from '../services/resourcePolicy';
import { completeUploadIntent, createUploadIntent } from '../services/evidenceUploadService';
import { evidenceStorage } from '../services/evidenceStorage';
import { legacyEvidenceList } from '../modules/catalog/evidenceRecords';
import { withCatalogRead } from '../modules/catalog/paging';

function isEvidenceEntityType(value: unknown): value is EvidenceEntityType {
  return typeof value === 'string' && (EVIDENCE_ENTITY_TYPES as readonly string[]).includes(value);
}

export async function listEvidence(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyEvidenceList(execute, req.user!, req.query)));
}

export async function createEvidenceUploadIntent(req: Request, res: Response): Promise<void> {
  res.status(201).json(await createUploadIntent(req.user!, req.body));
}

export async function uploadEvidenceContent(req: Request, res: Response): Promise<void> {
  const expires = Number(req.query.expires);
  const signature = typeof req.query.signature === 'string' ? req.query.signature : '';
  if (!Number.isSafeInteger(expires) || !signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'A valid signed upload URL and file body are required' }); return;
  }
  const evidence = await completeUploadIntent(req.params.id, expires, signature, req.body, req.headers['content-type']);
  res.status(201).json(evidence);
}

export async function downloadEvidence(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT e.*,
            c.seller_organization_id,
            c.buyer_organization_id,
            p.release_status
       FROM evidence_items e
       LEFT JOIN shipments sh ON e.linked_entity_type='shipment' AND e.linked_entity_id=sh.id
       LEFT JOIN sales_contracts c
         ON (e.linked_entity_type='contract' AND e.linked_entity_id=c.id) OR sh.contract_id=c.id
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

  if (item.validation_status !== 'validated' || item.review_status === 'rejected' || item.malware_scan_status !== 'clean') {
    res.status(423).json({ error: 'This document is unavailable until malware scanning completes', code: 'EVIDENCE_NOT_SCAN_CLEAN' });
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

  let content: Buffer | null = null;
  if (item.storage_key) content = await evidenceStorage().get(item.storage_key);
  else if (item.storage_provider === 'legacy_local' && item.storage_path) {
    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const filePath = path.resolve(item.storage_path);
    if (filePath.startsWith(uploadsRoot + path.sep) && fs.existsSync(filePath)) content = await fs.promises.readFile(filePath);
  }
  if (!content) {
    res.status(404).json({ error: 'Stored file not found' });
    return;
  }
  res.setHeader('Content-Type', item.detected_mime_type || item.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(item.file_name)}`);
  res.send(content);
}
