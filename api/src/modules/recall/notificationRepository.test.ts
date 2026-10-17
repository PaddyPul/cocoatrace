import { expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
vi.mock('../../db', () => ({ query: vi.fn() }));
import { claimRecallEmail } from './notificationRepository';
it('rolls back a failed recall email claim instead of leaving a transaction open', async () => {
  const failure = new Error('queue unavailable');
  const query = vi
    .fn()
    .mockResolvedValue({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(failure);
  await expect(claimRecallEmail({ query } as unknown as PoolClient, 'lease')).rejects.toBe(failure);
  expect(query.mock.calls[0][0]).toBe('BEGIN');
  expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
});
