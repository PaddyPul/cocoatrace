import { Pool } from 'pg';
import { config } from '../../config/env';
import logger from '../../logger';
import { runAlertCycle } from './alerts';

export function startOperationsAlertWorker(): () => Promise<void> {
  if (!config.operationsAlertsEnabled) return async () => {};
  const locks = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  locks.on('error', () =>
    logger.error(
      { event: 'OPERATIONS_ALERT_LOCK_FAILED' },
      'Operator alert coordination unavailable',
    ),
  );
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let closing: Promise<void> | undefined;
  const tick = async () => {
    if (stopped) return;
    let client;
    let lost = false;
    try {
      client = await locks.connect();
      await client.query("SET statement_timeout='5s'");
      const error = () => {
        lost = true;
      };
      client.on('error', error);
      try {
        if ((await runAlertCycle(client)) === 'failed')
          logger.error(
            { event: 'OPERATIONS_ALERT_UNHEALTHY' },
            'Operator alert cycle needs investigation',
          );
      } finally {
        client.removeListener('error', error);
      }
    } catch {
      lost = true;
      logger.error(
        { event: 'OPERATIONS_ALERT_CYCLE_FAILED' },
        'Operator alert cycle did not complete',
      );
    } finally {
      client?.release(lost);
      if (!stopped && !lost) {
        timer = setTimeout(() => void tick(), 60000);
        timer.unref();
      }
    }
  };
  // Allow the four existing jobs to record their initial observations first.
  timer = setTimeout(() => void tick(), 60000);
  timer.unref();
  return () => {
    if (closing) return closing;
    stopped = true;
    if (timer) clearTimeout(timer);
    closing = locks.end();
    return closing;
  };
}
