import { config } from '../../config/env';
import { query } from '../../db';
import { Pool } from 'pg';
import logger from '../../logger';
import { scanPendingEvidence } from '../evidenceMaintenance/scanPending';
import { runCleanupBatch } from '../evidenceCleanup/worker';
import { enqueueOverdueReminders, processPaymentReminderEmails } from '../payments/reminders';
import { processRecallEmails } from '../recall/notifications';
import { jobErrorCode, runTrackedJob, type Job } from './jobs';

const jobs: Job[] = [
  { name: 'evidence_scan', run: () => scanPendingEvidence({ batchSize: 5 }) },
  {
    name: 'evidence_cleanup',
    run: async () => {
      const result = await runCleanupBatch({ batchSize: 20 });
      const terminal = await query(
        "SELECT EXISTS(SELECT 1 FROM evidence_object_cleanup WHERE state='dead')::int n",
      );
      return { ...result, terminalFailures: terminal.rows[0].n };
    },
  },
  {
    name: 'payment_reminders',
    run: async () => {
      if (!config.identityEmailEnabled || config.emailDriver !== 'smtp') return { skipped: 1 };
      await enqueueOverdueReminders(20);
      const result = await processPaymentReminderEmails(undefined, 20);
      const terminal = await query(
        "SELECT EXISTS(SELECT 1 FROM payment_reminder_email_outbox WHERE status='failed_terminal')::int n",
      );
      return { ...result, terminalFailures: terminal.rows[0].n };
    },
  },
  {
    name: 'recall_email',
    run: async () => {
      if (!config.identityEmailEnabled || config.emailDriver !== 'smtp') return { skipped: 1 };
      const result = await processRecallEmails(undefined, 20);
      const terminal = await query(
        "SELECT EXISTS(SELECT 1 FROM recall_email_outbox WHERE status='failed_terminal')::int n",
      );
      return { ...result, terminalFailures: terminal.rows[0].n };
    },
  },
];

/** Each job has its own loop: a slow scanner cannot prevent reminder delivery. */
export function startOperationsWorkers(): () => Promise<void> {
  // Dedicated session connections prevent lock ownership from exhausting the
  // request/domain pool while jobs themselves need database connections.
  const lockPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  lockPool.on('error', () =>
    logger.error(
      { event: 'OPERATIONS_LOCK_CONNECTION_FAILED' },
      'Operations lock connection failed',
    ),
  );
  let stopped = false;
  let closing: Promise<void> | undefined;
  const timers = new Set<NodeJS.Timeout>();
  for (const job of jobs) {
    const tick = async () => {
      if (stopped) return;
      let client;
      let connectionLost = false;
      try {
        client = await lockPool.connect();
        await client.query("SET statement_timeout='5s'");
        const onError = () => {
          connectionLost = true;
        };
        client.on('error', onError);
        try {
          const outcome = await runTrackedJob(client, job);
          if (outcome === 'failed')
            logger.error(
              { job: job.name, event: 'OPERATIONS_JOB_UNHEALTHY' },
              'Operations job needs attention',
            );
        } finally {
          client.removeListener('error', onError);
        }
      } catch (error) {
        connectionLost = true;
        logger.error(
          { job: job.name, errorCode: jobErrorCode(error) },
          'Operations job did not complete',
        );
      } finally {
        // A lost session loses its advisory lock. Retire this loop rather than start
        // more provider work on another connection; the process must be restarted.
        client?.release(connectionLost);
        if (!stopped && !connectionLost) {
          const timer = setTimeout(
            () => {
              timers.delete(timer);
              void tick();
            },
            job.name === 'payment_reminders' || job.name === 'recall_email' ? 15_000 : 60_000,
          );
          timer.unref();
          timers.add(timer);
        }
      }
    };
    void tick();
  }
  return () => {
    if (closing) return closing;
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    closing = lockPool.end();
    return closing;
  };
}
