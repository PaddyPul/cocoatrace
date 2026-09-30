import { Server } from 'http';

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

type DatabasePool = {
  end(): Promise<void>;
};

type ShutdownLogger = {
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
};

type ShutdownOptions = {
  timeoutMs?: number;
  exit?: (code: number) => void;
};

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  });
}

export function createGracefulShutdown(
  server: Server,
  databasePool: DatabasePool,
  logger: ShutdownLogger,
  options: ShutdownOptions = {},
): (signal: ShutdownSignal) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const exit = options.exit ?? process.exit;
  let shutdownStarted = false;

  return async (signal: ShutdownSignal): Promise<void> => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    logger.info({ signal }, 'Graceful shutdown started');

    const deadline = setTimeout(() => {
      logger.error({ signal, timeoutMs }, 'Graceful shutdown timed out');
      exit(1);
    }, timeoutMs);
    deadline.unref();

    try {
      await closeServer(server);
      await databasePool.end();
      clearTimeout(deadline);
      logger.info({ signal }, 'Graceful shutdown complete');
      exit(0);
    } catch (error) {
      clearTimeout(deadline);
      logger.error({ error, signal }, 'Graceful shutdown failed');
      exit(1);
    }
  };
}

export function registerGracefulShutdown(
  server: Server,
  databasePool: DatabasePool,
  logger: ShutdownLogger,
  options: ShutdownOptions = {},
): void {
  const shutdown = createGracefulShutdown(server, databasePool, logger, options);
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
