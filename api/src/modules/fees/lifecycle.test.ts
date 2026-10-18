import type { PoolClient } from 'pg';
import { beforeEach, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ audit: vi.fn(), enqueue: vi.fn() }));
vi.mock('../trading/transaction', () => ({ recordTradeAudit: hooks.audit }));
vi.mock('../feeStatementDelivery/service', () => ({ enqueueFeeStatement: hooks.enqueue }));
import { makeFeeDue } from './lifecycle';
const actor = { id: 'user', organizationId: 'org' };
beforeEach(() => {
  vi.clearAllMocks();
});
it('queues the newly issued statement in the same transaction after the critical audit', async () => {
  const client = {
    query: vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'fee', amount_total: '1.00', currency: 'EUR' }] }),
  } as unknown as PoolClient;
  await makeFeeDue(client, actor, 'contract');
  expect(hooks.audit).toHaveBeenCalledOnce();
  expect(hooks.enqueue).toHaveBeenCalledWith(client, actor, 'contract');
  expect(hooks.audit.mock.invocationCallOrder[0]).toBeLessThan(
    hooks.enqueue.mock.invocationCallOrder[0],
  );
});
it('does not queue historical invoiced statements on an idempotent settlement call', async () => {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
  await makeFeeDue(client, actor, 'contract');
  expect(hooks.audit).not.toHaveBeenCalled();
  expect(hooks.enqueue).not.toHaveBeenCalled();
});
it('does not enqueue when the critical issuance audit fails', async () => {
  const client = {
    query: vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'fee', amount_total: '1.00', currency: 'EUR' }] }),
  } as unknown as PoolClient;
  hooks.audit.mockRejectedValueOnce(new Error('audit failed'));
  await expect(makeFeeDue(client, actor, 'contract')).rejects.toThrow('audit failed');
  expect(hooks.enqueue).not.toHaveBeenCalled();
});
