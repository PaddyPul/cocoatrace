import logger from './logger';
import { config } from './config/env';

async function start(): Promise<void> {
  // Dynamic import is intentional: authentication modules validate secrets at
  // module load time, so the environment must be loaded first.
  const { default: app } = await import('./app');
  app.listen(config.port, () => {
    logger.info({ port: config.port, environment: config.environment, demoMode: config.demoMode }, `CocoaTrace API running on port ${config.port}`);
  });
}

start().catch((error) => {
  logger.fatal({ error }, 'API failed to start');
  process.exit(1);
});
