import path from 'path';
import type { PoolClient } from 'pg';
import { getClient } from '../../db';
import { AppError } from '../../errors';
import logger from '../../logger';
import {
  evidenceMalwareScanner,
  type EvidenceMalwareScanner,
} from '../../services/evidenceMalwareScanner';
import {
  evidenceStorage,
  readBoundedEvidenceFile,
  type EvidenceStorage,
} from '../../services/evidenceStorage';

const jobLock = "hashtextextended('bettertrade.evidence.scan-pending',0)";
export const defaultScanPendingBatchSize = 50;
export const maximumScanPendingBatchSize = 100;

type Candidate = {
  id: string;
  storage_key?: string | null;
  storage_path?: string | null;
};

export type ScanPendingSummary = {
  busy: boolean;
  selected: number;
  clean: number;
  infected: number;
  /** Processing and cleanup incidents; an infected item can also increment this count. */
  failed: number;
};

type MaintenanceLogger = Pick<typeof logger, 'info' | 'warn' | 'error'>;
type MaintenanceStorage = Pick<EvidenceStorage, 'get' | 'delete'>;

export type ScanPendingOptions = {
  batchSize?: number;
  scanner?: EvidenceMalwareScanner;
  storage?: MaintenanceStorage;
  legacyUploadsRoot?: string;
  readLegacyFile?: (filename: string) => Promise<Buffer>;
  logger?: MaintenanceLogger;
  getClient?: () => Promise<PoolClient>;
};

function batchSize(value: number | undefined): number {
  const size = value ?? defaultScanPendingBatchSize;
  if (!Number.isSafeInteger(size) || size < 1 || size > maximumScanPendingBatchSize) {
    throw new RangeError(
      `Evidence scan batch size must be between 1 and ${maximumScanPendingBatchSize}.`,
    );
  }
  return size;
}

function safeErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)) return error.name;
  return 'UNKNOWN_ERROR';
}

function legacyFile(item: Candidate, uploadsRoot: string): string | null {
  if (!item.storage_path) return null;
  const root = path.resolve(uploadsRoot);
  const filename = path.resolve(item.storage_path);
  return filename.startsWith(root + path.sep) ? filename : null;
}

async function candidateContent(
  item: Candidate,
  storage: MaintenanceStorage,
  uploadsRoot: string,
  readLegacyFile: (filename: string) => Promise<Buffer>,
): Promise<Buffer | null> {
  if (item.storage_key) return storage.get(item.storage_key);
  const filename = legacyFile(item, uploadsRoot);
  if (!filename) return null;
  return readLegacyFile(filename);
}

async function markScanFailed(
  client: PoolClient,
  item: Candidate,
  log: MaintenanceLogger,
  error: unknown,
): Promise<void> {
  try {
    await client.query(
      `UPDATE evidence_items SET malware_scan_status='scan_failed',malware_scanned_at=NOW()
       WHERE id=$1 AND malware_scan_status IN ('legacy_unscanned','scan_failed')`,
      [item.id],
    );
    log.error(
      { evidenceId: item.id, errorCode: safeErrorCode(error), statusPersisted: true },
      'Evidence maintenance scan failed',
    );
  } catch (persistError) {
    log.error(
      {
        evidenceId: item.id,
        errorCode: safeErrorCode(error),
        persistenceErrorCode: safeErrorCode(persistError),
        statusPersisted: false,
      },
      'Evidence maintenance scan failure could not be persisted',
    );
    throw new AppError(
      'Evidence maintenance scan state could not be persisted.',
      503,
      'EVIDENCE_SCAN_STATE_PERSIST_FAILED',
    );
  }
}

export async function scanPendingEvidence(
  options: ScanPendingOptions = {},
): Promise<ScanPendingSummary> {
  const limit = batchSize(options.batchSize);
  const scanner = options.scanner ?? evidenceMalwareScanner();
  const storage = options.storage ?? evidenceStorage();
  const readLegacyFile = options.readLegacyFile ?? readBoundedEvidenceFile;
  const uploadsRoot = path.resolve(
    options.legacyUploadsRoot ?? path.resolve(__dirname, '../../../uploads'),
  );
  const log = options.logger ?? logger;
  const client = await (options.getClient ?? getClient)();
  let locked = false;
  let destroyClient = false;
  try {
    const lock = await client.query(`SELECT pg_try_advisory_lock(${jobLock}) AS acquired`);
    if (lock.rows[0]?.acquired !== true) {
      return { busy: true, selected: 0, clean: 0, infected: 0, failed: 0 };
    }
    locked = true;
    await scanner.healthcheck();
    const candidates = await client.query<Candidate>(
      `SELECT id,storage_key,storage_path FROM evidence_items
       WHERE malware_scan_status IN ('legacy_unscanned','scan_failed')
       ORDER BY malware_scanned_at NULLS FIRST,created_at,id LIMIT $1`,
      [limit],
    );
    const summary: ScanPendingSummary = {
      busy: false,
      selected: candidates.rows.length,
      clean: 0,
      infected: 0,
      failed: 0,
    };
    for (const item of candidates.rows) {
      try {
        const content = await candidateContent(item, storage, uploadsRoot, readLegacyFile);
        if (!content || content.length === 0) {
          throw new AppError('Stored evidence object is missing.', 503, 'EVIDENCE_OBJECT_MISSING');
        }
        const result = await scanner.scan(content);
        if (result.status === 'infected') {
          // Persist the security decision before deletion. A provider cleanup
          // incident must never rewrite an infected result as scan_failed.
          await client.query(
            `UPDATE evidence_items SET malware_scan_status='infected',malware_scanner_engine=$2,
              malware_scanned_at=NOW() WHERE id=$1
              AND malware_scan_status IN ('legacy_unscanned','scan_failed')`,
            [item.id, result.engine],
          );
          summary.infected += 1;
          log.warn({ evidenceId: item.id }, 'Evidence maintenance scan detected malware');
          if (item.storage_key) {
            try {
              await storage.delete(item.storage_key);
            } catch (deleteError) {
              summary.failed += 1;
              log.error(
                { evidenceId: item.id, errorCode: safeErrorCode(deleteError) },
                'Infected evidence cleanup failed',
              );
            }
          }
        } else {
          await client.query(
            `UPDATE evidence_items SET malware_scan_status='clean',malware_scanner_engine=$2,
              malware_scanned_at=NOW() WHERE id=$1
              AND malware_scan_status IN ('legacy_unscanned','scan_failed')`,
            [item.id, result.engine],
          );
          summary.clean += 1;
        }
      } catch (error) {
        summary.failed += 1;
        await markScanFailed(client, item, log, error);
      }
    }
    log.info(summary, 'Evidence maintenance scan batch complete');
    return summary;
  } finally {
    if (locked) {
      try {
        const unlocked = await client.query(`SELECT pg_advisory_unlock(${jobLock}) AS released`);
        if (unlocked.rows[0]?.released !== true) destroyClient = true;
      } catch {
        destroyClient = true;
      }
    }
    client.release(destroyClient);
  }
}
