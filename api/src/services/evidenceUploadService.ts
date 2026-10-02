import crypto from 'crypto';
import { QueryResultRow } from 'pg';
import { config } from '../config/env';
import { getClient, query } from '../db';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { JwtPayload } from '../middleware/auth';
import * as audit from './audit';
import { AllowedEvidenceMime, validateEvidenceContent, validateEvidenceMetadata } from './evidenceFilePolicy';
import { evidenceStorage } from './evidenceStorage';
import { evidenceMalwareScanner } from './evidenceMalwareScanner';
import { canAccessEvidenceEntity, EvidenceEntityType } from './resourcePolicy';

const evidenceColumns = `id,type,file_name,file_size_bytes,mime_type,detected_mime_type,
  sha256_hash,validation_status,malware_scan_status,malware_scanner_engine,malware_scanned_at,
  review_status,linked_entity_type,linked_entity_id,claim_description,created_at`;
const intentLifetimeSeconds = 15 * 60;

export type CreateEvidenceUploadIntent = {
  type: string;
  fileName: string;
  mimeType: AllowedEvidenceMime;
  fileSizeBytes: number;
  linkedEntityType: EvidenceEntityType;
  linkedEntityId: string;
  claimDescription?: string;
};

async function requireDocumentRole(actor: JwtPayload, input: CreateEvidenceUploadIntent): Promise<void> {
  if (input.linkedEntityType !== 'contract') return;
  const { rows } = await query(
    `SELECT seller_organization_id,buyer_organization_id FROM sales_contracts
      WHERE id=$1 AND (seller_organization_id=$2 OR buyer_organization_id=$2)`,
    [input.linkedEntityId, actor.organizationId],
  );
  const contract = rows[0];
  if (!contract) throw new ForbiddenError('Only a party to this contract can add documents');
  const sellerDocuments = new Set(['commercial_invoice', 'packing_list', 'quality_certificate', 'inspection_certificate', 'certificate_of_origin', 'insurance_certificate', 'transport_document', 'bill_of_lading', 'export_permit', 'other']);
  const buyerDocuments = new Set(['payment_proof', 'purchase_order', 'import_permit', 'compliance_document', 'eudr_supporting_document', 'delivery_receipt', 'delivery_proof', 'inspection_certificate', 'other']);
  const allowedTypes = contract.seller_organization_id === actor.organizationId ? sellerDocuments : buyerDocuments;
  if (!allowedTypes.has(input.type)) throw new ValidationError(`This contract party cannot upload document type: ${input.type}`);
}

function uploadSignature(intentId: string, objectKey: string, expires: number): string {
  return crypto.createHmac('sha256', config.evidenceUploadSigningSecret).update(`${intentId}.${objectKey}.${expires}`).digest('hex');
}

function signaturesMatch(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected, 'hex'); const b = Buffer.from(supplied, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function cleanupAbandonedUploads(): Promise<void> {
  const stale = await query(
    `WITH stale AS (
       SELECT id FROM evidence_upload_intents
       WHERE (status='pending' AND expires_at<=NOW()) OR (status IN ('uploading','scanning') AND updated_at<NOW()-INTERVAL '30 minutes')
       ORDER BY updated_at LIMIT 100 FOR UPDATE SKIP LOCKED
     )
     UPDATE evidence_upload_intents i
       SET status=CASE WHEN status='pending' THEN 'expired' ELSE 'scan_failed' END,
           malware_scan_status=CASE WHEN status='pending' THEN malware_scan_status ELSE 'scan_failed' END,
           rejection_reason=CASE WHEN status IN ('uploading','scanning') THEN 'Upload processing did not complete' ELSE rejection_reason END,
           updated_at=NOW()
     FROM stale WHERE i.id=stale.id RETURNING i.quarantine_object_key`,
  );
  await Promise.all(stale.rows.map((row) => evidenceStorage().delete(row.quarantine_object_key).catch(() => undefined)));
}

export async function createUploadIntent(actor: JwtPayload, rawInput: CreateEvidenceUploadIntent) {
  await cleanupAbandonedUploads();
  const metadata = validateEvidenceMetadata(rawInput.fileName, rawInput.mimeType);
  const input = { ...rawInput, ...metadata };
  if (input.fileSizeBytes > config.evidenceMaxFileBytes) throw new AppError(`Evidence files may not exceed ${config.evidenceMaxFileBytes} bytes`, 413, 'EVIDENCE_FILE_TOO_LARGE');
  if (!await canAccessEvidenceEntity(actor, input.linkedEntityType, input.linkedEntityId, null)) throw new ForbiddenError('You cannot attach evidence to this resource');
  await requireDocumentRole(actor, input);

  const id = crypto.randomUUID();
  const quarantineObjectKey = `quarantine/${config.environment}/${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + intentLifetimeSeconds * 1000);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`evidence-quota:${actor.organizationId}`]);
    const usage = await client.query(
      `SELECT COALESCE((SELECT SUM(file_size_bytes) FROM evidence_items WHERE uploader_organization_id=$1),0)::bigint AS stored_bytes,
        COALESCE((SELECT SUM(declared_size_bytes) FROM evidence_upload_intents
          WHERE uploader_organization_id=$1 AND status IN ('pending','uploading','scanning') AND expires_at>NOW()),0)::bigint AS reserved_bytes`,
      [actor.organizationId],
    );
    const projected = Number(usage.rows[0].stored_bytes) + Number(usage.rows[0].reserved_bytes) + input.fileSizeBytes;
    if (projected > config.evidenceOrganizationQuotaBytes) throw new AppError('Organization evidence storage quota would be exceeded', 413, 'EVIDENCE_QUOTA_EXCEEDED');
    await client.query(
      `INSERT INTO evidence_upload_intents
        (id,uploader_user_id,uploader_organization_id,evidence_type,original_file_name,claimed_mime_type,
         declared_size_bytes,linked_entity_type,linked_entity_id,claim_description,quarantine_object_key,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, actor.id, actor.organizationId, input.type, input.fileName, input.mimeType, input.fileSizeBytes,
        input.linkedEntityType, input.linkedEntityId, input.claimDescription || '', quarantineObjectKey, expiresAt],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined); throw error;
  } finally { client.release(); }
  const expires = Math.floor(expiresAt.getTime() / 1000);
  const signature = uploadSignature(id, quarantineObjectKey, expires);
  await audit.record({ actorUserId: actor.id, actorOrganizationId: actor.organizationId, action: 'evidence.upload_intent.create', entityType: 'evidence_upload_intent', entityId: id });
  return { intentId: id, uploadUrl: `/evidence/upload-intents/${id}/content?expires=${expires}&signature=${signature}`, expiresAt: expiresAt.toISOString(), maxFileBytes: config.evidenceMaxFileBytes };
}

async function rejectIntent(id: string, reason: string): Promise<void> {
  await query(`UPDATE evidence_upload_intents SET status='rejected',rejection_reason=$2,updated_at=NOW() WHERE id=$1 AND status IN ('pending','uploading','scanning')`, [id, reason]);
}

export async function completeUploadIntent(intentId: string, expires: number, signature: string, content: Buffer, requestMimeType?: string) {
  const { rows } = await query('SELECT * FROM evidence_upload_intents WHERE id=$1', [intentId]);
  const intent = rows[0];
  if (!intent) throw new NotFoundError('Upload intent');
  const expectedExpiry = Math.floor(new Date(intent.expires_at).getTime() / 1000);
  const expectedSignature = uploadSignature(intent.id, intent.quarantine_object_key, expectedExpiry);
  if (expires !== expectedExpiry || !/^[0-9a-f]{64}$/.test(signature) || !signaturesMatch(expectedSignature, signature)) throw new ForbiddenError('Upload URL is invalid');
  if (Date.now() >= new Date(intent.expires_at).getTime()) {
    await query("UPDATE evidence_upload_intents SET status='expired',updated_at=NOW() WHERE id=$1 AND status='pending'", [intentId]);
    throw new AppError('Upload URL has expired', 410, 'UPLOAD_INTENT_EXPIRED');
  }
  if (intent.status === 'completed' && intent.evidence_item_id) {
    const completed = await query(`SELECT ${evidenceColumns} FROM evidence_items WHERE id=$1`, [intent.evidence_item_id]); return completed.rows[0];
  }
  if (intent.status !== 'pending') throw new ConflictError(`Upload intent is ${intent.status}`);
  if (content.length !== Number(intent.declared_size_bytes)) { await rejectIntent(intentId, 'Uploaded size does not match the declared size'); throw new ValidationError('Uploaded size does not match the declared size'); }
  if (content.length > config.evidenceMaxFileBytes) { await rejectIntent(intentId, 'File exceeds the configured size limit'); throw new AppError('Evidence file is too large', 413, 'EVIDENCE_FILE_TOO_LARGE'); }
  if (requestMimeType && requestMimeType !== 'application/octet-stream' && requestMimeType !== intent.claimed_mime_type) { await rejectIntent(intentId, 'Request content type does not match the upload intent'); throw new ValidationError('Request content type does not match the upload intent'); }
  const claimed = await query(`UPDATE evidence_upload_intents SET status='uploading',updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id`, [intentId]);
  if (!claimed.rows[0]) throw new ConflictError('Upload intent is already being processed');

  const storage = evidenceStorage(); let finalObjectKey: string | undefined;
  try {
    await storage.put(intent.quarantine_object_key, content, intent.claimed_mime_type);
    await query(`UPDATE evidence_upload_intents SET status='scanning',malware_scan_status='scanning',updated_at=NOW() WHERE id=$1 AND status='uploading'`, [intentId]);
    let scanResult;
    try {
      scanResult = await evidenceMalwareScanner().scan(content);
    } catch (error) {
      await query(
        `UPDATE evidence_upload_intents SET status='scan_failed',malware_scan_status='scan_failed',
          rejection_reason=$2,malware_scanned_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='scanning'`,
        [intentId, error instanceof Error ? error.message : 'Malware scanner failed'],
      );
      await audit.record({ actorUserId: intent.uploader_user_id, actorOrganizationId: intent.uploader_organization_id, action: 'evidence.scan.failed', entityType: 'evidence_upload_intent', entityId: intentId });
      throw new AppError('Evidence malware scanning is temporarily unavailable; upload the file again later', 503, 'EVIDENCE_SCAN_UNAVAILABLE');
    }
    if (scanResult.status === 'infected') {
      await query(
        `UPDATE evidence_upload_intents SET status='infected',malware_scan_status='infected',malware_signature=$2,
          malware_scanner_engine=$3,malware_scanned_at=NOW(),rejection_reason='Malware detected',updated_at=NOW()
         WHERE id=$1 AND status='scanning'`,
        [intentId, scanResult.signature, scanResult.engine],
      );
      await audit.record({ actorUserId: intent.uploader_user_id, actorOrganizationId: intent.uploader_organization_id, action: 'evidence.scan.infected', entityType: 'evidence_upload_intent', entityId: intentId });
      throw new AppError('The uploaded file was rejected by malware scanning', 422, 'MALWARE_DETECTED');
    }
    await query(
      `UPDATE evidence_upload_intents SET malware_scan_status='clean',malware_scanner_engine=$2,
        malware_scanned_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='scanning'`,
      [intentId, scanResult.engine],
    );
    const detected = validateEvidenceContent(content, intent.claimed_mime_type as AllowedEvidenceMime);
    finalObjectKey = `evidence/${config.environment}/${crypto.randomUUID()}`;
    await storage.move(intent.quarantine_object_key, finalObjectKey, detected);
    const hash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
    const client = await getClient(); let evidence: QueryResultRow;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO evidence_items
          (uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,detected_mime_type,
           sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,malware_scanner_engine,
           malware_scanned_at,review_status,linked_entity_type,linked_entity_id,claim_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'validated','clean',$11,NOW(),'submitted',$12,$13,$14) RETURNING ${evidenceColumns}`,
        [intent.uploader_user_id, intent.uploader_organization_id, intent.evidence_type, intent.original_file_name,
          content.length, detected, detected, hash, finalObjectKey, storage.provider, scanResult.engine,
          intent.linked_entity_type, intent.linked_entity_id, intent.claim_description],
      );
      evidence = inserted.rows[0];
      await client.query(`UPDATE evidence_upload_intents SET status='completed',evidence_item_id=$2,updated_at=NOW() WHERE id=$1 AND status='scanning' AND malware_scan_status='clean'`, [intentId, evidence.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await audit.record({ actorUserId: intent.uploader_user_id, actorOrganizationId: intent.uploader_organization_id, action: 'evidence.upload.complete', entityType: 'evidence_item', entityId: evidence.id, newStateHash: hash });
    return evidence;
  } catch (error) {
    await storage.delete(intent.quarantine_object_key).catch(() => undefined);
    if (finalObjectKey) await storage.delete(finalObjectKey).catch(() => undefined);
    await rejectIntent(intentId, error instanceof Error ? error.message : 'Evidence validation failed'); throw error;
  }
}
