import type { RequestHandler } from 'express';

const boundsMs = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 15000] as const;
function histogram() {
  let count = 0,
    sumMs = 0;
  const buckets = boundsMs.map(() => 0);
  return {
    observe(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
      count = Math.min(Number.MAX_SAFE_INTEGER, count + 1);
      sumMs = Math.min(Number.MAX_SAFE_INTEGER, sumMs + milliseconds);
      boundsMs.forEach((bound, index) => {
        if (milliseconds <= bound)
          buckets[index] = Math.min(Number.MAX_SAFE_INTEGER, buckets[index] + 1);
      });
    },
    read: () => ({
      count,
      sumMs,
      buckets: boundsMs.map((upperBoundMs, index) => ({ upperBoundMs, count: buckets[index] })),
      overflowCount: count - buckets[buckets.length - 1],
    }),
  };
}
export function createRuntimeMetrics() {
  const startedAt = new Date().toISOString();
  const http = histogram(),
    databaseQuery = histogram(),
    databaseAcquisition = histogram();
  let queryErrors = 0,
    acquisitionErrors = 0;
  const responses = {
    informational: 0,
    successful: 0,
    redirected: 0,
    clientError: 0,
    serverError: 0,
  };
  return {
    recordHttp(milliseconds: number, status: number) {
      http.observe(milliseconds);
      const key =
        status >= 500
          ? 'serverError'
          : status >= 400
            ? 'clientError'
            : status >= 300
              ? 'redirected'
              : status >= 200
                ? 'successful'
                : 'informational';
      responses[key] = Math.min(Number.MAX_SAFE_INTEGER, responses[key] + 1);
    },
    recordQuery(milliseconds: number, failed: boolean) {
      databaseQuery.observe(milliseconds);
      if (failed) queryErrors = Math.min(Number.MAX_SAFE_INTEGER, queryErrors + 1);
    },
    recordAcquisition(milliseconds: number, failed: boolean) {
      databaseAcquisition.observe(milliseconds);
      if (failed) acquisitionErrors = Math.min(Number.MAX_SAFE_INTEGER, acquisitionErrors + 1);
    },
    read: () => ({
      schemaVersion: 1,
      startedAt,
      scope: 'this API process since startup; not a deployment-wide or durable monitoring record',
      http: {
        durationMs: http.read(),
        responses: { ...responses },
        coverage: 'completed HTTP responses; no routes or request metadata',
      },
      database: {
        queryDurationMs: databaseQuery.read(),
        queryErrors,
        acquisitionDurationMs: databaseAcquisition.read(),
        acquisitionErrors,
        coverage:
          'exported query helper duration includes pool acquisition; exported getClient acquisition excludes subsequent transaction queries',
      },
      queues: {
        source: '/operations/backlog',
        coverage: 'separate bounded current queue observations; not inferred from process counters',
      },
    }),
  };
}
export const runtimeMetrics = createRuntimeMetrics();
export const observeHttp: RequestHandler = (_req, res, next) => {
  const started = performance.now();
  res.once('finish', () => runtimeMetrics.recordHttp(performance.now() - started, res.statusCode));
  next();
};
