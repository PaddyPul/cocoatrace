import { describe, expect, it } from 'vitest';
import { createRuntimeMetrics } from './runtimeMetrics';

describe('bounded private runtime observations', () => {
  it('retains fixed cumulative buckets and overflow rather than individual samples', () => {
    const metrics = createRuntimeMetrics();
    [1, 26, 16000].forEach((value) => metrics.recordQuery(value, false));
    metrics.recordQuery(Number.NaN, false);
    expect(metrics.read().database.queryDurationMs).toMatchObject({
      count: 3,
      sumMs: 16027,
      overflowCount: 1,
    });
    expect(metrics.read().database.queryDurationMs.buckets).toHaveLength(11);
    expect(metrics.read().database.queryDurationMs.buckets[0]).toEqual({
      upperBoundMs: 1,
      count: 1,
    });
    expect(metrics.read().database.queryDurationMs.buckets[4]).toEqual({
      upperBoundMs: 50,
      count: 2,
    });
  });
  it('counts failures independently and returns snapshots without mutable retained references', () => {
    const metrics = createRuntimeMetrics();
    metrics.recordAcquisition(8, true);
    metrics.recordQuery(12, true);
    metrics.recordHttp(15, 503);
    const first = metrics.read();
    first.http.responses.serverError = 999;
    first.database.queryDurationMs.buckets[0].count = 999;
    expect(metrics.read().http.responses.serverError).toBe(1);
    expect(metrics.read().database.queryDurationMs.buckets[0].count).toBe(0);
    expect(metrics.read().database).toMatchObject({ acquisitionErrors: 1, queryErrors: 1 });
  });
  it('keeps a constant shape after many requests, with no paths, identities, SQL or payload labels', () => {
    const metrics = createRuntimeMetrics();
    for (let i = 0; i < 10000; i++) metrics.recordHttp(i, 200);
    const snapshot = metrics.read();
    expect(snapshot.http.durationMs.count).toBe(10000);
    expect(Object.keys(snapshot.http.responses)).toHaveLength(5);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /password|authorization|tenantId|userId|queryText|url|endpoint/,
    );
    expect(JSON.stringify(snapshot).length).toBeLessThan(3500);
  });
});
