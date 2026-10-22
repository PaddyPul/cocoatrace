import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { config } from '../../config/env';
import { getClient, query } from '../../db';
import { hashObject } from '../../services/audit';
import { AppError } from '../../errors';
import logger from '../../logger';
import { evidenceStorage, type EvidenceStorage } from '../../services/evidenceStorage';

export const defaultCleanupBatchSize = 50;
export const maximumCleanupBatchSize = 100;
const maximumAttempts = 8;
const leaseSeconds = 5 * 60;

type CleanupJob = {
  id: string;
  object_key: string;
  storage_provider: 'local' | 's3';
  reason: string;
  attempts: number;
  evidence_id: string | null;
};

type WorkerStorage = Pick<EvidenceStorage, 'provider' | 'delete'>;
type WorkerLogger = Pick<typeof logger, 'info' | 'warn' | 'error'>;

export type CleanupSummary = {
  sweptIntents: number;
  selected: number;
  deleted: number;
  retried: number;
  dead: number;
  lostClaims: number;
};

export type CleanupWorkerOptions = {
  batchSize?: number;
  storage?: WorkerStorage;
  logger?: WorkerLogger;
  random?: () => number;
  getClient?: () => Promise<PoolClient>;
};

function boundedBatchSize(value: number | undefined): number {
  const size = value ?? defaultCleanupBatchSize;
  if (!Number.isSafeInteger(size) || size < 1 || size > maximumCleanupBatchSize) {
    throw new RangeError(
      `Evidence cleanup batch size must be between 1 and ${maximumCleanupBatchSize}.`,
    );
  }
  return size;
}

function safeErrorCode(error: unknown): string {
  const candidate =
    error instanceof AppError ? error.code : error instanceof Error ? error.name : '';
  const normalized = candidate
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return normalized && /^[A-Z0-9_]+$/.test(normalized) ? normalized : 'UNKNOWN_ERROR';
}

function validObjectKey(objectKey: string): boolean {
  const escaped = config.environment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^(?:quarantine|evidence)/${escaped}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    'i',
  ).test(objectKey);
}

async function sweepStaleIntents(client: PoolClient, limit: number): Promise<number> {
  await client.query('BEGIN');
  try {
    const swept = await client.query(
      `WITH candidates AS MATERIALIZED (
         SELECT i.id,i.status,i.evidence_item_id
         FROM evidence_upload_intents i
         WHERE EXISTS (
           SELECT 1 FROM evidence_object_cleanup held
           WHERE held.upload_intent_id=i.id AND held.state='held'
         ) AND (
           i.status IN ('completed','rejected','expired','infected','scan_failed')
           OR (i.status='pending' AND i.expires_at<=NOW())
           OR (i.status IN ('uploading','scanning') AND i.updated_at<NOW()-INTERVAL '30 minutes')
         )
         ORDER BY i.updated_at,i.id LIMIT $1 FOR UPDATE OF i SKIP LOCKED
       ), terminalized AS (
         UPDATE evidence_upload_intents i
            SET status=CASE WHEN candidates.status='pending' THEN 'expired' ELSE 'scan_failed' END,
                malware_scan_status=CASE WHEN candidates.status='pending' THEN i.malware_scan_status ELSE 'scan_failed' END,
                rejection_reason=CASE WHEN candidates.status='pending' THEN i.rejection_reason ELSE 'Upload processing did not complete' END,
                updated_at=NOW()
           FROM candidates WHERE i.id=candidates.id
             AND candidates.status IN ('pending','uploading','scanning')
         RETURNING i.id,i.uploader_organization_id,i.status
       ), audited AS (
         INSERT INTO audit_events
           (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
         SELECT '00000000-0000-4000-8000-000000000002'::uuid,uploader_organization_id,
           'evidence.upload.abandoned','evidence_upload_intent',id,
           'sha256:'||encode(sha256(convert_to(id::text||':'||status,'UTF8')),'hex'),
           jsonb_build_object('source','cleanup_sweep','outcome',status)
         FROM terminalized RETURNING id
       )
       UPDATE evidence_object_cleanup c
          SET state=CASE
                WHEN candidates.status='completed' AND evidence.id IS NOT NULL
                  AND c.object_key=evidence.storage_key
                  AND evidence.validation_status='validated'
                  AND evidence.malware_scan_status='clean' THEN 'retained'
                ELSE 'pending'
              END,
              evidence_id=CASE
                WHEN candidates.status='completed' AND c.object_key=evidence.storage_key
                  THEN evidence.id ELSE c.evidence_id
              END,
              reason=CASE
                WHEN candidates.status='completed' AND evidence.id IS NOT NULL
                  AND c.object_key=evidence.storage_key
                  AND evidence.validation_status='validated'
                  AND evidence.malware_scan_status='clean' THEN c.reason
                WHEN candidates.status IN ('pending','expired') THEN 'upload_expired'
                WHEN candidates.status IN ('rejected','infected') THEN 'upload_rejected'
                ELSE 'upload_stalled'
              END,
              next_attempt_at=NOW(),lease_token=NULL,lease_expires_at=NULL,updated_at=NOW()
         FROM candidates
         LEFT JOIN evidence_items evidence ON evidence.id=candidates.evidence_item_id
         WHERE c.upload_intent_id=candidates.id AND c.state='held'
       RETURNING c.id`,
      [limit],
    );
    await client.query('COMMIT');
    return swept.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function expireExhaustedClaims(client: PoolClient, limit: number): Promise<number> {
  const expired = await client.query(
    `WITH exhausted AS (
       SELECT id FROM evidence_object_cleanup
       WHERE state='processing' AND lease_expires_at<=NOW() AND attempts>=$2
       ORDER BY lease_expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED
     )
     UPDATE evidence_object_cleanup c
        SET state='dead',last_error_code='MAX_ATTEMPTS_EXCEEDED',lease_token=NULL,
            lease_expires_at=NULL,updated_at=NOW()
       FROM exhausted WHERE c.id=exhausted.id
     RETURNING c.id`,
    [limit, maximumAttempts],
  );
  return expired.rowCount ?? 0;
}

async function claimJobs(client: PoolClient, limit: number, token: string): Promise<CleanupJob[]> {
  const claimed = await client.query<CleanupJob>(
    `WITH candidates AS (
       SELECT id FROM evidence_object_cleanup
       WHERE ((state='pending' AND next_attempt_at<=NOW())
           OR (state='processing' AND lease_expires_at<=NOW()))
         AND attempts<$2
       ORDER BY next_attempt_at,created_at,id
       LIMIT $1 FOR UPDATE SKIP LOCKED
     )
     UPDATE evidence_object_cleanup c
        SET state='processing',lease_token=$3,lease_expires_at=NOW()+($4::int*INTERVAL '1 second'),
            attempts=c.attempts+1,updated_at=NOW()
       FROM candidates WHERE c.id=candidates.id
     RETURNING c.id,c.object_key,c.storage_provider,c.reason,c.attempts,c.evidence_id`,
    [limit, maximumAttempts, token, leaseSeconds],
  );
  return claimed.rows;
}

async function liveReferenceAllowsDelete(client: PoolClient, job: CleanupJob): Promise<boolean> {
  const referenced = await client.query<{
    id: string;
    storage_key: string | null;
    malware_scan_status: string;
  }>(
    `SELECT id,storage_key,malware_scan_status FROM evidence_items
     WHERE storage_key=$1 OR ($2::uuid IS NOT NULL AND id=$2)`,
    [job.object_key, job.evidence_id],
  );
  if (referenced.rows.length === 0) return true;
  return (
    job.reason === 'malware_infected' &&
    referenced.rows.every(
      (row) => row.storage_key === job.object_key && row.malware_scan_status === 'infected',
    )
  );
}

async function markDead(
  client: PoolClient,
  job: CleanupJob,
  token: string,
  errorCode: string,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE evidence_object_cleanup
       SET state='dead',last_error_code=$4,lease_token=NULL,lease_expires_at=NULL,updated_at=NOW()
     WHERE id=$1 AND state='processing' AND lease_token=$2 AND attempts=$3`,
    [job.id, token, job.attempts, errorCode],
  );
  return result.rowCount === 1;
}

function retryDelayMs(attempts: number, random: () => number): number {
  const base = Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempts, 12));
  return Math.floor(base * (0.75 + Math.max(0, Math.min(1, random())) * 0.5));
}

async function retryOrDead(
  client: PoolClient,
  job: CleanupJob,
  token: string,
  errorCode: string,
  random: () => number,
): Promise<'retried' | 'dead' | 'lost'> {
  if (job.attempts >= maximumAttempts) {
    return (await markDead(client, job, token, errorCode)) ? 'dead' : 'lost';
  }
  const result = await client.query(
    `UPDATE evidence_object_cleanup
       SET state='pending',last_error_code=$4,next_attempt_at=$5,lease_token=NULL,
           lease_expires_at=NULL,updated_at=NOW()
     WHERE id=$1 AND state='processing' AND lease_token=$2 AND attempts=$3`,
    [
      job.id,
      token,
      job.attempts,
      errorCode,
      new Date(Date.now() + retryDelayMs(job.attempts, random)),
    ],
  );
  return result.rowCount === 1 ? 'retried' : 'lost';
}

async function processJob(
  client: PoolClient,
  job: CleanupJob,
  token: string,
  storage: WorkerStorage,
  random: () => number,
): Promise<'deleted' | 'retried' | 'dead' | 'lost'> {
  if (!validObjectKey(job.object_key)) {
    return (await markDead(client, job, token, 'INVALID_OBJECT_KEY')) ? 'dead' : 'lost';
  }
  if (job.storage_provider !== storage.provider) {
    return (await markDead(client, job, token, 'STORAGE_PROVIDER_MISMATCH')) ? 'dead' : 'lost';
  }
  if (!(await liveReferenceAllowsDelete(client, job))) {
    return (await markDead(client, job, token, 'LIVE_EVIDENCE_REFERENCE')) ? 'dead' : 'lost';
  }
  try {
    await storage.delete(job.object_key);
  } catch (error) {
    return retryOrDead(client, job, token, safeErrorCode(error), random);
  }
  const completed = await client.query(
    `WITH completed AS (
     UPDATE evidence_object_cleanup
       SET state='done',deleted_at=NOW(),last_error_code=NULL,lease_token=NULL,
           lease_expires_at=NULL,updated_at=NOW()
     WHERE id=$1 AND state='processing' AND lease_token=$2 AND attempts=$3
     RETURNING id,organization_id,reason
     )
     INSERT INTO audit_events
       (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
     SELECT '00000000-0000-4000-8000-000000000002'::uuid,organization_id,
       'evidence.cleanup.deleted','evidence_object_cleanup',id,
       $4::text,jsonb_build_object('source','cleanup','outcome','provider_delete_acknowledged','reason',reason)
     FROM completed RETURNING entity_id`,
    [
      job.id,
      token,
      job.attempts,
      hashObject({ id: job.id, outcome: 'provider_delete_acknowledged' }),
    ],
  );
  return completed.rowCount === 1 ? 'deleted' : 'lost';
}

async function executeClaimed(
  client: PoolClient,
  jobs: CleanupJob[],
  token: string,
  storage: WorkerStorage,
  random: () => number,
  log: WorkerLogger,
): Promise<Omit<CleanupSummary, 'sweptIntents' | 'selected'>> {
  const result = { deleted: 0, retried: 0, dead: 0, lostClaims: 0 };
  for (const job of jobs) {
    const outcome = await processJob(client, job, token, storage, random);
    if (outcome === 'lost') result.lostClaims += 1;
    else result[outcome] += 1;
    if (outcome !== 'deleted') {
      log.warn({ cleanupId: job.id, outcome }, 'Evidence object cleanup did not complete');
    }
  }
  return result;
}

export async function runCleanupBatch(options: CleanupWorkerOptions = {}): Promise<CleanupSummary> {
  const limit = boundedBatchSize(options.batchSize);
  const storage = options.storage ?? evidenceStorage();
  const log = options.logger ?? logger;
  const random = options.random ?? Math.random;
  const client = await (options.getClient ?? getClient)();
  try {
    const sweptIntents = await sweepStaleIntents(client, limit);
    const exhausted = await expireExhaustedClaims(client, limit);
    const outcomes = { deleted: 0, retried: 0, dead: exhausted, lostClaims: 0 };
    let selected = 0;
    // Claim immediately before provider I/O. Claiming the full batch here
    // would let later leases expire while earlier slow deletions are running.
    while (selected < limit) {
      const token = crypto.randomUUID();
      const jobs = await claimJobs(client, 1, token);
      if (jobs.length === 0) break;
      selected += 1;
      const outcome = await executeClaimed(client, jobs, token, storage, random, log);
      outcomes.deleted += outcome.deleted;
      outcomes.retried += outcome.retried;
      outcomes.dead += outcome.dead;
      outcomes.lostClaims += outcome.lostClaims;
    }
    const summary = { sweptIntents, selected, ...outcomes };
    log.info(summary, 'Evidence object cleanup batch complete');
    return summary;
  } finally {
    client.release();
  }
}

/** Best-effort immediate acceleration. The durable pending row remains on any failure. */
export async function cleanupObjectNow(
  objectKey: string,
  options: Omit<CleanupWorkerOptions, 'batchSize'> = {},
): Promise<boolean> {
  const storage = options.storage ?? evidenceStorage();
  const log = options.logger ?? logger;
  const client = await (options.getClient ?? getClient)();
  const token = crypto.randomUUID();
  try {
    const claimed = await client.query<CleanupJob>(
      `UPDATE evidence_object_cleanup
          SET state='processing',lease_token=$2,lease_expires_at=NOW()+($3::int*INTERVAL '1 second'),
              attempts=attempts+1,updated_at=NOW()
        WHERE object_key=$1 AND state='pending' AND next_attempt_at<=NOW() AND attempts<$4
      RETURNING id,object_key,storage_provider,reason,attempts,evidence_id`,
      [objectKey, token, leaseSeconds, maximumAttempts],
    );
    const job = claimed.rows[0];
    if (!job) return false;
    const outcome = await processJob(client, job, token, storage, options.random ?? Math.random);
    if (outcome !== 'deleted') {
      log.warn({ cleanupId: job.id, outcome }, 'Immediate evidence cleanup did not complete');
    }
    return outcome === 'deleted';
  } finally {
    client.release();
  }
}

export const cleanupQuotaBytesSql = `
  SELECT COALESCE(SUM(bytes),0)::bigint AS cleanup_bytes
  FROM evidence_object_cleanup
  WHERE organization_id=$1 AND state IN ('held','pending','processing','dead')`;

// Retained for consumers that need a pool-level query without a transaction.
export async function cleanupQuotaBytes(organizationId: string): Promise<number> {
  const result = await query(cleanupQuotaBytesSql, [organizationId]);
  return Number(result.rows[0]?.cleanup_bytes ?? 0);
}
