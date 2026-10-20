import type { PoolClient } from 'pg';
import { runtimeMetrics } from './runtimeMetrics';

const observed = new WeakSet<PoolClient>();

/** Observe promise/callback queries once per physical client, without retaining SQL or parameters. */
export function observeDatabaseClient(
  client: PoolClient,
  record = runtimeMetrics.recordQuery,
): PoolClient {
  if (observed.has(client)) return client;
  observed.add(client);
  const original = client.query;
  client.query = function (this: PoolClient, ...args: unknown[]) {
    const started = performance.now();
    let completed = false;
    const finish = (failed: boolean) => {
      if (completed) return;
      completed = true;
      record(performance.now() - started, failed);
    };
    const last = args.length - 1;
    const callback = args[last];
    if (typeof callback === 'function') {
      args[last] = function (this: unknown, ...values: unknown[]) {
        finish(values[0] != null);
        return Reflect.apply(callback, this, values);
      };
    }
    try {
      const result: unknown = Reflect.apply(original, this, args);
      if (result instanceof Promise) {
        // Observe without replacing the promise returned to the caller.
        void result.then(
          () => finish(false),
          () => finish(true),
        );
      }
      return result;
    } catch (error) {
      finish(true);
      throw error;
    }
  } as PoolClient['query'];
  return client;
}
