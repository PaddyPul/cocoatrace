import dotenv from 'dotenv';
import path from 'path';
import logger from './logger';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3001;

async function start(): Promise<void> {
  // Dynamic import is intentional: authentication modules validate secrets at
  // module load time, so the environment must be loaded first.
  const { default: app } = await import('./app');
  app.listen(PORT, () => {
    logger.info({ port: PORT }, `CocoaTrace API running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  logger.fatal({ error }, 'API failed to start');
  process.exit(1);
});
