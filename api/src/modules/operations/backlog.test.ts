import { describe, expect, it, vi } from 'vitest';
vi.mock('../catalog/paging', () => ({ withCatalogRead: vi.fn() }));
import { loadQueueBacklog, queueSignal } from './backlog';
const now = '2026-10-13T17:00:00.000Z';
const empty = {
  queued: 0,
  leased: 0,
  terminal: 0,
  retrying: 0,
  expired: 0,
  oldest_due: null,
  observed_at: now,
};
describe('bounded queue incident observations', () => {
  it('reports empty observed queues without inventing delivery success', () => {
    expect(queueSignal('cleanup', empty)).toMatchObject({
      queued: { count: 0, more: false },
      incidents: [],
      oldestDueAt: null,
    });
  });
  it('caps each count and labels incomplete observation as an incident', () => {
    expect(queueSignal('recall', { ...empty, queued: 1001, retrying: 1001 })).toMatchObject({
      queued: { count: 1000, more: true },
      retryingObserved: 1000,
      incidents: ['MONITOR_LIMIT_REACHED'],
    });
  });
  it('distinguishes terminal work, expired leases and overdue work at the threshold', () => {
    expect(
      queueSignal('payment_reminder', {
        ...empty,
        queued: 2,
        leased: 1,
        terminal: 1,
        retrying: 1,
        expired: 1,
        oldest_due: '2026-10-13T16:45:00.000Z',
      }).incidents,
    ).toEqual(['TERMINAL_WORK_PENDING', 'EXPIRED_LEASE', 'OVERDUE_WORK']);
    expect(
      queueSignal('cleanup', { ...empty, queued: 1, oldest_due: '2026-10-13T16:45:00.001Z' })
        .incidents,
    ).toEqual([]);
  });
  it.each([undefined, null, true, -1, 0.5, 1002, '0'])('refuses invalid counts: %s', (queued) => {
    expect(() => queueSignal('cleanup', { ...empty, queued })).toThrow('Invalid queue observation');
  });
  it('refuses inconsistent, missing or future observation dates', () => {
    for (const changed of [
      { retrying: 1 },
      { expired: 1 },
      { observed_at: null },
      { oldest_due: '2026-10-13T18:00:00Z' },
    ])
      expect(() => queueSignal('cleanup', { ...empty, ...changed })).toThrow(
        'Invalid queue observation',
      );
  });
  it('uses fixed three bounded metadata-only probes in one read snapshot', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [empty] });
    const snapshot = await loadQueueBacklog(execute);
    expect(snapshot).toMatchObject({
      observedAt: now,
      limit: 1000,
      overdueAfterSeconds: 900,
      needsAttention: false,
    });
    expect(snapshot.queues.map((queue) => queue.name)).toEqual([
      'cleanup',
      'payment_reminder',
      'recall',
    ]);
    expect(execute).toHaveBeenCalledTimes(3);
    for (const [sql] of execute.mock.calls) {
      expect(sql.match(/LIMIT 1001/g)).toHaveLength(3);
      expect(sql).not.toMatch(/recipient|object_key|last_error|SELECT \*/);
    }
  });
  it('never returns a partial snapshot after a failed or absent queue read', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [empty] })
      .mockRejectedValueOnce(new Error('provider data'));
    await expect(loadQueueBacklog(execute)).rejects.toThrow('provider data');
    await expect(loadQueueBacklog(vi.fn().mockResolvedValue({ rows: [] }))).rejects.toThrow(
      'Missing queue observation',
    );
  });
});
