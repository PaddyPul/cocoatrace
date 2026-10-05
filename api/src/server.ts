import { startPaymentReminderWorker } from './modules/payments/reminders';
import {startRecallEmailWorker} from './modules/recall/notifications';
import logger from './logger';
import { config } from './config/env';
import { pool } from './db';
import { registerGracefulShutdown } from './gracefulShutdown';

async function start(): Promise<void> {
  // Dynamic import is intentional: authentication modules validate secrets at
  // module load time, so the environment must be loaded first.
  const { default: app } = await import('./app');
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, environment: config.environment, demoMode: config.demoMode }, `CocoaTrace API running on port ${config.port}`);
  });
  const stopRecallEmails=startRecallEmailWorker();
  const stopPaymentReminders = startPaymentReminderWorker();
  server.on('close', () => { stopRecallEmails(); stopPaymentReminders(); });
  registerGracefulShutdown(server, pool, logger);
}

start().catch((error) => {
  logger.fatal({ error }, 'API failed to start');
  process.exit(1);
});
