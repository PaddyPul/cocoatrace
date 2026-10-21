import crypto from 'crypto';
import logger from '../logger';
import type { PoolClient } from 'pg';
import {
  registerObject,
  queueIntentObjects,
  retainUploadObjects,
} from '../modules/evidenceCleanup/repository';
import { cleanupObjectNow } from '../modules/evidenceCleanup/worker';
import { QueryResultRow } from 'pg';
import { config } from '../config/env';
import { getClient, query } from '../db';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { JwtPayload } from '../middleware/auth';
import { recordAudit } from './auditWriter';
import { inDatabaseTransaction } from './databaseTransaction';
import {
  AllowedEvidenceMime,
  validateEvidenceContent,
  validateEvidenceMetadata,
} from './evidenceFilePolicy';
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

export async function requireDocumentRole(
  actor: JwtPayload,
  input: Pick<CreateEvidenceUploadIntent, 'linkedEntityType' | 'linkedEntityId' | 'type'>,
  execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }> = query,
): Promise<void> {
  if (input.linkedEntityType !== 'contract') return;
  const { rows } = await execute(
    `SELECT seller_organization_id,buyer_organization_id FROM sales_contracts
      WHERE id=$1 AND (seller_organization_id=$2 OR buyer_organization_id=$2)`,
    [input.linkedEntityId, actor.organizationId],
  );
  const contract = rows[0];
  if (!contract) throw new ForbiddenError('Only a party to this contract can add documents');
  const sellerDocuments = new Set([
    'commercial_invoice',
    'packing_list',
    'quality_certificate',
    'inspection_certificate',
    'certificate_of_origin',
    'insurance_certificate',
    'transport_document',
    'bill_of_lading',
    'export_permit',
    'other',
  ]);
  const buyerDocuments = new Set([
    'payment_proof',
    'purchase_order',
    'import_permit',
    'compliance_document',
    'eudr_supporting_document',
    'delivery_receipt',
    'delivery_proof',
    'inspection_certificate',
    'other',
  ]);
  const allowedTypes =
    contract.seller_organization_id === actor.organizationId ? sellerDocuments : buyerDocuments;
  if (!allowedTypes.has(input.type))
    throw new ValidationError(`This contract party cannot upload document type: ${input.type}`);
}

function uploadSignature(intentId: string, objectKey: string, expires: number): string {
  return crypto
    .createHmac('sha256', config.evidenceUploadSigningSecret)
    .update(`${intentId}.${objectKey}.${expires}`)
    .digest('hex');
}

function signaturesMatch(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(supplied, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Validate the bearer upload capability before allocating a request body. The
// completing transaction still rechecks lifecycle, ownership and exact bytes.
export async function authorizeUploadContent(
  intentId: string,
  expires: number,
  signature: string,
): Promise<{ organizationId: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intentId))
    throw new ValidationError('Invalid upload intent');
  if (!Number.isSafeInteger(expires) || !signature)
    throw new ValidationError('A valid signed upload URL is required');
  const { rows } = await query(
    'SELECT id,uploader_organization_id,quarantine_object_key,expires_at,status,evidence_item_id FROM evidence_upload_intents WHERE id=$1',
    [intentId],
  );
  const intent = rows[0];
  if (!intent) throw new NotFoundError('Upload intent');
  const expectedExpiry = Math.floor(new Date(intent.expires_at).getTime() / 1000);
  if (
    expires !== expectedExpiry ||
    !/^[0-9a-f]{64}$/.test(signature) ||
    !signaturesMatch(
      uploadSignature(intent.id, intent.quarantine_object_key, expectedExpiry),
      signature,
    )
  )
    throw new ForbiddenError('Upload URL is invalid');
  if (Date.now() >= new Date(intent.expires_at).getTime())
    throw new AppError('Upload URL has expired', 410, 'UPLOAD_INTENT_EXPIRED');
  if (intent.status !== 'pending' && !(intent.status === 'completed' && intent.evidence_item_id))
    throw new ConflictError(`Upload intent is ${intent.status}`);
  return { organizationId: intent.uploader_organization_id };
}

async function reservedObjectBytes(client: PoolClient, organizationId: string): Promise<number> {
  const usage = await client.query(
    `SELECT
    COALESCE((SELECT SUM(e.file_size_bytes) FROM evidence_items e WHERE e.uploader_organization_id=$1
      AND NOT EXISTS(SELECT 1 FROM evidence_object_cleanup j WHERE j.object_key=e.storage_key AND j.state<>'retained')),0)::bigint AS stored_bytes,
    COALESCE((SELECT SUM(j.bytes) FROM evidence_object_cleanup j WHERE j.organization_id=$1 AND j.state IN ('held','pending','processing','dead')),0)::bigint AS cleanup_bytes,
    COALESCE((SELECT SUM(i.declared_size_bytes) FROM evidence_upload_intents i WHERE i.uploader_organization_id=$1
      AND i.status<>'completed' AND NOT EXISTS(SELECT 1 FROM evidence_object_cleanup j WHERE j.object_key=i.quarantine_object_key)),0)::bigint AS legacy_reserved_bytes`,
    [organizationId],
  );
  const row = usage.rows[0];
  return Number(row.stored_bytes) + Number(row.cleanup_bytes) + Number(row.legacy_reserved_bytes);
}
async function lockEvidenceQuota(client: PoolClient, organizationId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `evidence-quota:${organizationId}`,
  ]);
}
async function requireObjectCapacity(
  client: PoolClient,
  organizationId: string,
  bytes: number,
): Promise<void> {
  if (
    (await reservedObjectBytes(client, organizationId)) + bytes >
    config.evidenceOrganizationQuotaBytes
  )
    throw new AppError(
      'Organization evidence storage quota would be exceeded',
      413,
      'EVIDENCE_QUOTA_EXCEEDED',
    );
}

export async function createUploadIntent(actor: JwtPayload, rawInput: CreateEvidenceUploadIntent) {
  const metadata = validateEvidenceMetadata(rawInput.fileName, rawInput.mimeType);
  const input = { ...rawInput, ...metadata };
  if (input.fileSizeBytes > config.evidenceMaxFileBytes)
    throw new AppError(
      `Evidence files may not exceed ${config.evidenceMaxFileBytes} bytes`,
      413,
      'EVIDENCE_FILE_TOO_LARGE',
    );
  if (!(await canAccessEvidenceEntity(actor, input.linkedEntityType, input.linkedEntityId, null)))
    throw new ForbiddenError('You cannot attach evidence to this resource');
  await requireDocumentRole(actor, input);

  const id = crypto.randomUUID();
  const quarantineObjectKey = `quarantine/${config.environment}/${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + intentLifetimeSeconds * 1000);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockEvidenceQuota(client, actor.organizationId);
    await requireObjectCapacity(client, actor.organizationId, input.fileSizeBytes);
    await client.query(
      `INSERT INTO evidence_upload_intents
        (id,uploader_user_id,uploader_organization_id,evidence_type,original_file_name,claimed_mime_type,
         declared_size_bytes,linked_entity_type,linked_entity_id,claim_description,quarantine_object_key,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        actor.id,
        actor.organizationId,
        input.type,
        input.fileName,
        input.mimeType,
        input.fileSizeBytes,
        input.linkedEntityType,
        input.linkedEntityId,
        input.claimDescription || '',
        quarantineObjectKey,
        expiresAt,
      ],
    );
    await registerObject(client, {
      objectKey: quarantineObjectKey,
      organizationId: actor.organizationId,
      bytes: input.fileSizeBytes,
      storageProvider: evidenceStorage().provider,
      uploadIntentId: id,
      reason: 'upload_quarantine',
    });
    await recordAudit(client, actor, 'evidence.upload_intent.create', 'evidence_upload_intent', id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const expires = Math.floor(expiresAt.getTime() / 1000);
  const signature = uploadSignature(id, quarantineObjectKey, expires);
  return {
    intentId: id,
    uploadUrl: `/evidence/upload-intents/${id}/content?expires=${expires}&signature=${signature}`,
    expiresAt: expiresAt.toISOString(),
    maxFileBytes: config.evidenceMaxFileBytes,
  };
}

async function rejectIntent(id: string, reason: string): Promise<void> {
  const client = await getClient();
  let rejectedKey: string | undefined;
  try {
    await client.query('BEGIN');
    const lookup = await client.query(
      'SELECT uploader_organization_id,quarantine_object_key FROM evidence_upload_intents WHERE id=$1',
      [id],
    );
    if (!lookup.rows[0]) {
      await client.query('ROLLBACK');
      return;
    }
    await lockEvidenceQuota(client, lookup.rows[0].uploader_organization_id);
    // A rejected replay must not cancel an upload already claimed by another request.
    const changed = await client.query(
      `UPDATE evidence_upload_intents SET status='rejected',rejection_reason=$2,updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id`,
      [id, reason],
    );
    if (changed.rowCount === 1) {
      await queueIntentObjects(client, id, 'upload_rejected');
      rejectedKey = lookup.rows[0].quarantine_object_key;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (rejectedKey)
    await cleanupObjectNow(rejectedKey).catch(() => {
      logger.warn({ intentId: id }, 'Rejected upload cleanup requires durable retry');
    });
}

export async function completeUploadIntent(
  intentId: string,
  expires: number,
  signature: string,
  content: Buffer,
  requestMimeType?: string,
) {
  const { rows } = await query('SELECT * FROM evidence_upload_intents WHERE id=$1', [intentId]);
  const intent = rows[0];
  if (!intent) throw new NotFoundError('Upload intent');
  const expectedExpiry = Math.floor(new Date(intent.expires_at).getTime() / 1000);
  const expectedSignature = uploadSignature(
    intent.id,
    intent.quarantine_object_key,
    expectedExpiry,
  );
  if (
    expires !== expectedExpiry ||
    !/^[0-9a-f]{64}$/.test(signature) ||
    !signaturesMatch(expectedSignature, signature)
  )
    throw new ForbiddenError('Upload URL is invalid');
  if (Date.now() >= new Date(intent.expires_at).getTime()) {
    await query(
      "UPDATE evidence_upload_intents SET status='expired',updated_at=NOW() WHERE id=$1 AND status='pending'",
      [intentId],
    );
    throw new AppError('Upload URL has expired', 410, 'UPLOAD_INTENT_EXPIRED');
  }
  if (intent.status === 'completed' && intent.evidence_item_id) {
    const completed = await query(`SELECT ${evidenceColumns} FROM evidence_items WHERE id=$1`, [
      intent.evidence_item_id,
    ]);
    return completed.rows[0];
  }
  if (intent.status !== 'pending') throw new ConflictError(`Upload intent is ${intent.status}`);
  if (content.length !== Number(intent.declared_size_bytes)) {
    await rejectIntent(intentId, 'Uploaded size does not match the declared size');
    throw new ValidationError('Uploaded size does not match the declared size');
  }
  if (content.length > config.evidenceMaxFileBytes) {
    await rejectIntent(intentId, 'File exceeds the configured size limit');
    throw new AppError('Evidence file is too large', 413, 'EVIDENCE_FILE_TOO_LARGE');
  }
  if (
    requestMimeType &&
    requestMimeType !== 'application/octet-stream' &&
    requestMimeType !== intent.claimed_mime_type
  ) {
    await rejectIntent(intentId, 'Request content type does not match the upload intent');
    throw new ValidationError('Request content type does not match the upload intent');
  }
  const claimed = await query(
    `UPDATE evidence_upload_intents SET status='uploading',updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id`,
    [intentId],
  );
  if (!claimed.rows[0]) throw new ConflictError('Upload intent is already being processed');

  const storage = evidenceStorage();
  let finalObjectKey: string | undefined;
  let completed = false;
  try {
    await storage.put(intent.quarantine_object_key, content, intent.claimed_mime_type);
    await query(
      `UPDATE evidence_upload_intents SET status='scanning',malware_scan_status='scanning',updated_at=NOW() WHERE id=$1 AND status='uploading'`,
      [intentId],
    );
    let scanResult;
    try {
      scanResult = await evidenceMalwareScanner().scan(content);
    } catch (error) {
      await inDatabaseTransaction(async (client) => {
        const changed = await client.query(
          `UPDATE evidence_upload_intents SET status='scan_failed',malware_scan_status='scan_failed',
          rejection_reason=$2,malware_scanned_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='scanning'`,
          [intentId, error instanceof Error ? error.message : 'Malware scanner failed'],
        );
        if (changed.rowCount !== 1) throw new ConflictError('Upload intent is no longer scanning');
        await recordAudit(
          client,
          { id: intent.uploader_user_id, organizationId: intent.uploader_organization_id },
          'evidence.scan.failed',
          'evidence_upload_intent',
          intentId,
        );
      });
      throw new AppError(
        'Evidence malware scanning is temporarily unavailable; upload the file again later',
        503,
        'EVIDENCE_SCAN_UNAVAILABLE',
      );
    }
    if (scanResult.status === 'infected') {
      await inDatabaseTransaction(async (client) => {
        const changed = await client.query(
          `UPDATE evidence_upload_intents SET status='infected',malware_scan_status='infected',malware_signature=$2,
          malware_scanner_engine=$3,malware_scanned_at=NOW(),rejection_reason='Malware detected',updated_at=NOW()
         WHERE id=$1 AND status='scanning'`,
          [intentId, scanResult.signature, scanResult.engine],
        );
        if (changed.rowCount !== 1) throw new ConflictError('Upload intent is no longer scanning');
        await recordAudit(
          client,
          { id: intent.uploader_user_id, organizationId: intent.uploader_organization_id },
          'evidence.scan.infected',
          'evidence_upload_intent',
          intentId,
        );
      });
      throw new AppError(
        'The uploaded file was rejected by malware scanning',
        422,
        'MALWARE_DETECTED',
      );
    }
    await query(
      `UPDATE evidence_upload_intents SET malware_scan_status='clean',malware_scanner_engine=$2,
        malware_scanned_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='scanning'`,
      [intentId, scanResult.engine],
    );
    const detected = validateEvidenceContent(
      content,
      intent.claimed_mime_type as AllowedEvidenceMime,
    );
    finalObjectKey = `evidence/${config.environment}/${crypto.randomUUID()}`;
    const reservationClient = await getClient();
    try {
      await reservationClient.query('BEGIN');
      await lockEvidenceQuota(reservationClient, intent.uploader_organization_id);
      await requireObjectCapacity(
        reservationClient,
        intent.uploader_organization_id,
        content.length,
      );
      await registerObject(reservationClient, {
        objectKey: finalObjectKey,
        organizationId: intent.uploader_organization_id,
        bytes: content.length,
        storageProvider: storage.provider,
        uploadIntentId: intentId,
        reason: 'upload_final',
      });
      await reservationClient.query('COMMIT');
    } catch (error) {
      await reservationClient.query('ROLLBACK');
      throw error;
    } finally {
      reservationClient.release();
    }
    await storage.move(intent.quarantine_object_key, finalObjectKey, detected);
    const hash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
    const client = await getClient();
    let evidence: QueryResultRow;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO evidence_items
          (uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,detected_mime_type,
           sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,malware_scanner_engine,
           malware_scanned_at,review_status,linked_entity_type,linked_entity_id,claim_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'validated','clean',$11,NOW(),'submitted',$12,$13,$14) RETURNING ${evidenceColumns}`,
        [
          intent.uploader_user_id,
          intent.uploader_organization_id,
          intent.evidence_type,
          intent.original_file_name,
          content.length,
          detected,
          detected,
          hash,
          finalObjectKey,
          storage.provider,
          scanResult.engine,
          intent.linked_entity_type,
          intent.linked_entity_id,
          intent.claim_description,
        ],
      );
      evidence = inserted.rows[0];
      const transitioned = await client.query(
        `UPDATE evidence_upload_intents SET status='completed',evidence_item_id=$2,updated_at=NOW() WHERE id=$1 AND status='scanning' AND malware_scan_status='clean'`,
        [intentId, evidence.id],
      );
      if (transitioned.rowCount !== 1)
        throw new ConflictError('Upload intent is no longer clean and scanning');
      await retainUploadObjects(client, intentId, finalObjectKey, evidence.id);
      await recordAudit(
        client,
        { id: intent.uploader_user_id, organizationId: intent.uploader_organization_id },
        'evidence.upload.complete',
        'evidence_item',
        evidence.id,
        {},
        { newStateHash: hash },
      );
      await client.query('COMMIT');
      completed = true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return evidence;
  } catch (error) {
    if (!completed) {
      const failureClient = await getClient();
      try {
        await failureClient.query('BEGIN');
        await lockEvidenceQuota(failureClient, intent.uploader_organization_id);
        await failureClient.query(
          `UPDATE evidence_upload_intents SET status=CASE WHEN status IN ('pending','uploading','scanning') THEN 'rejected' ELSE status END,rejection_reason=COALESCE(rejection_reason,'Evidence processing failed'),updated_at=NOW() WHERE id=$1 AND status<>'completed'`,
          [intentId],
        );
        await queueIntentObjects(failureClient, intentId, 'upload_rejected');
        await failureClient.query('COMMIT');
      } catch (persistError) {
        await failureClient.query('ROLLBACK').catch(() => undefined);
        logger.error(
          { intentId },
          'Evidence cleanup obligation could not be queued; held objects require recovery',
        );
        throw persistError;
      } finally {
        failureClient.release();
      }
      // Acceleration only: the ledger remains charged and retryable if a
      // provider or worker fails. Never fan out untracked deletes.
      for (const objectKey of [intent.quarantine_object_key, finalObjectKey]) {
        if (objectKey)
          await cleanupObjectNow(objectKey).catch(() => {
            logger.warn(
              { intentId },
              'Evidence cleanup acceleration failed; durable retry required',
            );
          });
      }
    }
    throw error;
  }
}
