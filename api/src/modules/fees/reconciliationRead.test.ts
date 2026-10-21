import { beforeEach, describe, expect, it, vi } from 'vitest';
const deps = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock('../../db', () => ({ getClient: deps.connect }));
vi.mock('./reconciliation', () => ({ reconcileFees: deps.reconcile }));
import { readFeeReconciliation } from './reconciliationRead';
beforeEach(() => {
  vi.resetAllMocks();
  deps.connect.mockResolvedValue({ query: deps.query, release: deps.release });
});
describe('fee reconciliation snapshot', () => {
  it('commits and releases its read-only repeatable snapshot before returning the report', async () => {
    const report = { issues: [] };
    deps.reconcile.mockResolvedValue(report);
    expect(await readFeeReconciliation()).toBe(report);
    expect(deps.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'COMMIT',
    ]);
    expect(deps.release).toHaveBeenCalledOnce();
  });
  it('rolls back and releases on a failed reconciliation', async () => {
    deps.reconcile.mockRejectedValue(new Error('read unavailable'));
    await expect(readFeeReconciliation()).rejects.toThrow('read unavailable');
    expect(deps.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(deps.release).toHaveBeenCalledOnce();
  });
});
