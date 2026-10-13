import { Server } from 'http';
import { describe, expect, it, vi } from 'vitest';
import { createGracefulShutdown } from './gracefulShutdown';

function dependencies(closeError?: Error) {
  const server = {
    close: vi.fn((callback: (error?: Error) => void) => callback(closeError)),
    closeIdleConnections: vi.fn(),
  } as unknown as Server;
  const pool = { end: vi.fn().mockResolvedValue(undefined) };
  const logger = { info: vi.fn(), error: vi.fn() };
  const exit = vi.fn();
  return { server, pool, logger, exit };
}

describe('graceful shutdown', () => {
  it('drains active background work before ending the domain pool', async () => {
    const { server, pool, logger, exit } = dependencies();
    let finish!: () => void;
    const drained = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const stopBackgroundWork = vi.fn(() => drained);
    const shutdown = createGracefulShutdown(server, pool, logger, { exit, stopBackgroundWork });
    const running = shutdown('SIGTERM');
    await Promise.resolve();
    expect(stopBackgroundWork).toHaveBeenCalledTimes(1);
    expect(pool.end).not.toHaveBeenCalled();
    finish();
    await running;
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
  it('keeps the finite shutdown deadline when a provider job never drains', async () => {
    vi.useFakeTimers();
    try {
      const { server, pool, logger, exit } = dependencies();
      const shutdown = createGracefulShutdown(server, pool, logger, {
        exit,
        timeoutMs: 10,
        stopBackgroundWork: () => new Promise<void>(() => undefined),
      });
      void shutdown('SIGTERM');
      await vi.advanceTimersByTimeAsync(11);
      expect(exit).toHaveBeenCalledWith(1);
      expect(pool.end).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('stops accepting HTTP work, closes the database pool and exits successfully once', async () => {
    const { server, pool, logger, exit } = dependencies();
    const shutdown = createGracefulShutdown(server, pool, logger, { exit });

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'Graceful shutdown complete');
  });

  it('does not close the database pool when HTTP shutdown fails', async () => {
    const { server, pool, logger, exit } = dependencies(new Error('close failed'));
    const shutdown = createGracefulShutdown(server, pool, logger, { exit });

    await shutdown('SIGTERM');

    expect(pool.end).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ signal: 'SIGTERM' }),
      'Graceful shutdown failed',
    );
  });
});
