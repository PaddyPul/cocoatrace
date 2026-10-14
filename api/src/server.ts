import { startOperationsWorkers } from './modules/operations/worker';
import logger from './logger';
import { startOperationsAlertWorker } from './modules/operations/alertWorker';
import { config } from './config/env';
import { pool } from './db';
import { registerGracefulShutdown } from './gracefulShutdown';

async function start(): Promise<void> {
  // Dynamic import is intentional: authentication modules validate secrets at
  // module load time, so the environment must be loaded first.
  const { default: app } = await import('./app');
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, environment: config.environment, demoMode: config.demoMode },
      `CocoaTrace API running on port ${config.port}`,
    );
  });
  const stopWorkers = startOperationsWorkers();
  const stopAlerts = startOperationsAlertWorker();
  registerGracefulShutdown(server, pool, logger, {
    stopBackgroundWork: () => Promise.all([stopWorkers(), stopAlerts()]).then(() => undefined),
  });
}

start().catch((error) => {
  logger.fatal({ error }, 'API failed to start');
  process.exit(1);
});
