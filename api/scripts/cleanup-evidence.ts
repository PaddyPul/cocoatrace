import { pool } from '../src/db';
import { AppError } from '../src/errors';
import logger from '../src/logger';
import { defaultCleanupBatchSize, runCleanupBatch } from '../src/modules/evidenceCleanup/worker';

function configuredBatchSize(): number {
  const value = process.env.EVIDENCE_CLEANUP_BATCH_SIZE;
  return value === undefined ? defaultCleanupBatchSize : Number(value);
}

function safeErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  const candidate = error instanceof Error ? error.name : '';
  const normalized = candidate
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return normalized || 'UNKNOWN_ERROR';
}

export async function runEvidenceCleanupCli(): Promise<number> {
  const summary = await runCleanupBatch({ batchSize: configuredBatchSize() });
  logger.info(summary, 'Evidence cleanup run complete');
  return summary.dead > 0 || summary.retried > 0 || summary.lostClaims > 0 ? 1 : 0;
}

if (require.main === module) {
  void runEvidenceCleanupCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      logger.error({ errorCode: safeErrorCode(error) }, 'Evidence cleanup job failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
