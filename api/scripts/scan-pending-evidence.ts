import { pool } from '../src/db';
import { AppError } from '../src/errors';
import logger from '../src/logger';
import {
  defaultScanPendingBatchSize,
  scanPendingEvidence,
} from '../src/modules/evidenceMaintenance/scanPending';

function configuredBatchSize(): number {
  const configured = process.env.EVIDENCE_SCAN_BATCH_SIZE;
  return configured === undefined ? defaultScanPendingBatchSize : Number(configured);
}

function safeErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)) return error.name;
  return 'UNKNOWN_ERROR';
}

export async function runScanPendingEvidenceCli(): Promise<number> {
  const summary = await scanPendingEvidence({ batchSize: configuredBatchSize() });
  logger.info(summary, 'Pending evidence scan complete');
  return summary.failed > 0 ? 1 : 0;
}

if (require.main === module) {
  void runScanPendingEvidenceCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      logger.error({ errorCode: safeErrorCode(error) }, 'Pending evidence scan job failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
