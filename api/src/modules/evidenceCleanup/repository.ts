import type { PoolClient } from 'pg';
import { ConflictError, ValidationError } from '../../errors';

export const cleanupReasons = [
  'upload_quarantine',
  'upload_final',
  'upload_rejected',
  'upload_expired',
  'upload_stalled',
  'malware_infected',
] as const;

export type CleanupReason = (typeof cleanupReasons)[number];
export type CleanupProvider = 'local' | 's3';

export type RegisterCleanupObject = {
  objectKey: string;
  organizationId: string;
  bytes: number;
  storageProvider: CleanupProvider;
  uploadIntentId?: string | null;
  evidenceId?: string | null;
  reason: CleanupReason;
  state?: 'held' | 'pending';
};

type CleanupIdentity = {
  object_key: string;
  organization_id: string;
  bytes: string | number;
  storage_provider: CleanupProvider;
  upload_intent_id: string | null;
  evidence_id: string | null;
  reason: CleanupReason;
};

function sameNullable(left: string | null | undefined, right: string | null): boolean {
  return (left ?? null) === right;
}

/** Register a possible object before provider I/O. The caller owns the transaction. */
export async function registerObject(
  client: PoolClient,
  input: RegisterCleanupObject,
): Promise<void> {
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 0) {
    throw new ValidationError('Cleanup object bytes must be a non-negative safe integer');
  }
  const inserted = await client.query<CleanupIdentity>(
    `INSERT INTO evidence_object_cleanup
       (object_key,organization_id,bytes,storage_provider,upload_intent_id,evidence_id,state,reason)
     VALUES($1,$2,$3,$4,$5,$6,$8,$7)
     ON CONFLICT(object_key) DO NOTHING
     RETURNING object_key,organization_id,bytes,storage_provider,upload_intent_id,evidence_id,reason`,
    [
      input.objectKey,
      input.organizationId,
      input.bytes,
      input.storageProvider,
      input.uploadIntentId ?? null,
      input.evidenceId ?? null,
      input.reason,
      input.state ?? 'held',
    ],
  );
  if (inserted.rows[0]) return;
  const existing = await client.query<CleanupIdentity>(
    `SELECT object_key,organization_id,bytes,storage_provider,upload_intent_id,evidence_id,reason
       FROM evidence_object_cleanup WHERE object_key=$1`,
    [input.objectKey],
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.organization_id !== input.organizationId ||
    Number(row.bytes) !== input.bytes ||
    row.storage_provider !== input.storageProvider ||
    !sameNullable(input.uploadIntentId, row.upload_intent_id) ||
    !sameNullable(input.evidenceId, row.evidence_id) ||
    row.reason !== input.reason
  ) {
    throw new ConflictError('Cleanup object key is already registered to another object');
  }
}

export type QueueInfectedEvidenceObject = Omit<
  RegisterCleanupObject,
  'uploadIntentId' | 'reason' | 'state'
> & { evidenceId: string };

/** Persist an infected evidence deletion obligation in the infection transaction. */
export async function queueInfectedEvidenceObject(
  client: PoolClient,
  input: QueueInfectedEvidenceObject,
): Promise<void> {
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 0) {
    throw new ValidationError('Cleanup object bytes must be a non-negative safe integer');
  }
  const result = await client.query(
    `INSERT INTO evidence_object_cleanup
       (object_key,organization_id,bytes,storage_provider,evidence_id,state,reason,next_attempt_at)
     VALUES($1,$2,$3,$4,$5,'pending','malware_infected',NOW())
     ON CONFLICT(object_key) DO UPDATE
       SET state=CASE
             WHEN evidence_object_cleanup.state IN ('held','retained') THEN 'pending'
             ELSE evidence_object_cleanup.state
           END,
           reason=CASE
             WHEN evidence_object_cleanup.state IN ('held','retained','pending') THEN 'malware_infected'
             ELSE evidence_object_cleanup.reason
           END,
           evidence_id=COALESCE(evidence_object_cleanup.evidence_id,EXCLUDED.evidence_id),
           next_attempt_at=CASE
             WHEN evidence_object_cleanup.state IN ('held','retained') THEN NOW()
             ELSE evidence_object_cleanup.next_attempt_at
           END,
           updated_at=NOW()
     WHERE evidence_object_cleanup.organization_id=EXCLUDED.organization_id
       AND evidence_object_cleanup.bytes=EXCLUDED.bytes
       AND evidence_object_cleanup.storage_provider=EXCLUDED.storage_provider
       AND (evidence_object_cleanup.evidence_id IS NULL OR evidence_object_cleanup.evidence_id=EXCLUDED.evidence_id)
       AND evidence_object_cleanup.state<>'dead'
     RETURNING id`,
    [input.objectKey, input.organizationId, input.bytes, input.storageProvider, input.evidenceId],
  );
  if (result.rowCount === 1) return;
  const existing = await client.query<CleanupIdentity & { state: string }>(
    `SELECT object_key,organization_id,bytes,storage_provider,upload_intent_id,evidence_id,reason,state
       FROM evidence_object_cleanup WHERE object_key=$1`,
    [input.objectKey],
  );
  const row = existing.rows[0];
  if (
    row?.state === 'dead' &&
    row.organization_id === input.organizationId &&
    Number(row.bytes) === input.bytes &&
    row.storage_provider === input.storageProvider &&
    row.evidence_id === input.evidenceId
  ) {
    return;
  }
  throw new ConflictError('Infected evidence cleanup registration conflicts with object ownership');
}

/** Make every held object for a terminal upload eligible for durable cleanup. */
export async function queueIntentObjects(
  client: PoolClient,
  intentId: string,
  reason: Extract<CleanupReason, 'upload_rejected' | 'upload_expired' | 'upload_stalled'>,
): Promise<number> {
  const result = await client.query(
    `UPDATE evidence_object_cleanup
       SET state='pending',reason=$2,next_attempt_at=NOW(),lease_token=NULL,
           lease_expires_at=NULL,updated_at=NOW()
     WHERE upload_intent_id=$1 AND state='held'`,
    [intentId, reason],
  );
  return result.rowCount ?? 0;
}

/** Finalize ledger ownership in the same transaction that creates the evidence row. */
export async function retainUploadObjects(
  client: PoolClient,
  intentId: string,
  finalKey: string,
  evidenceId: string,
): Promise<void> {
  const final = await client.query(
    `UPDATE evidence_object_cleanup
       SET state='retained',evidence_id=$3,lease_token=NULL,lease_expires_at=NULL,
           deleted_at=NULL,updated_at=NOW()
     WHERE upload_intent_id=$1 AND object_key=$2 AND state='held'`,
    [intentId, finalKey, evidenceId],
  );
  if (final.rowCount !== 1) {
    throw new ConflictError('Final evidence object is not registered for this upload');
  }
  await client.query(
    `UPDATE evidence_object_cleanup
       SET state='done',lease_token=NULL,lease_expires_at=NULL,deleted_at=NOW(),updated_at=NOW()
     WHERE upload_intent_id=$1 AND object_key<>$2 AND state='held'`,
    [intentId, finalKey],
  );
}
