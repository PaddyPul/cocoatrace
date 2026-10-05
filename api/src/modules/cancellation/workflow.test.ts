import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('../../db', () => db);
import {
  cancellationBlock,
  requestCancellation,
  reviewCancellation,
  type CancellationFacts,
} from './workflow';
const clean: CancellationFacts = {
  status: 'accepted',
  paymentActivity: false,
  securityActivity: false,
  transportActivity: false,
  issueActivity: false,
  feeActivity: false,
  inventorySafe: true,
};
const seller = { id: 'seller-user', organizationId: 'seller' };
const buyer = { id: 'buyer-user', organizationId: 'buyer' };
function fixture(
  options: {
    facts?: Partial<CancellationFacts>;
    status?: string;
    requester?: string;
    missing?: boolean;
    held?: boolean;
    auditFailure?: boolean;
    pending?: boolean;
  } = {},
) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const row = {
    id: 'request',
    contract_id: 'contract',
    requested_by_organization_id: options.requester ?? 'seller',
    reason: 'Buyer changed procurement schedule',
    status: options.status ?? 'requested',
  };
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes('FROM sales_contracts WHERE'))
        return {
          rows: options.missing
            ? []
            : [
                {
                  id: 'contract',
                  status: options.facts?.status ?? 'accepted',
                  holding_id: 'holding',
                  seller_organization_id: 'seller',
                  buyer_organization_id: 'buyer',
                },
              ],
        };
      if (sql.includes('AS "paymentActivity"')) return { rows: [{ ...clean, ...options.facts }] };
      if (sql.includes('FROM contract_cancellation_requests WHERE id=')) return { rows: [row] };
      if (sql.includes('FROM contract_cancellation_requests WHERE contract_id='))
        return { rows: options.pending ? [row] : [] };
      if (sql.includes('SELECT batch_id')) return { rows: [{ batch_id: 'batch' }] };
      if (sql.includes(' AS held')) return { rows: [{ held: options.held ?? false }] };
      if (sql.startsWith('INSERT INTO contract_cancellation_requests')) return { rows: [row] };
      if (sql.startsWith('UPDATE contract_cancellation_requests'))
        return { rows: [{ ...row, status: values?.[0] }] };
      if (sql.includes('INSERT INTO audit_events') && options.auditFailure)
        throw new Error('audit failed');
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  db.getClient.mockResolvedValue(client);
  return { calls, client };
}
beforeEach(() => vi.resetAllMocks());
describe('conservative pre-dispatch cancellation', () => {
  it('permits an intact, unstarted unpaid contract', () =>
    expect(cancellationBlock(clean)).toBeNull());
  it.each(['cancelled', 'settled'])('blocks closed status %s', (status) =>
    expect(cancellationBlock({ ...clean, status })).toBeTruthy(),
  );
  it.each([
    'paymentActivity',
    'securityActivity',
    'transportActivity',
    'issueActivity',
    'feeActivity',
  ] as const)('blocks %s', (flag) =>
    expect(cancellationBlock({ ...clean, [flag]: true })).toBeTruthy(),
  );
  it('blocks changed inventory', () =>
    expect(cancellationBlock({ ...clean, inventorySafe: false })).toBeTruthy());
  it('request keeps inventory committed and writes an attributable audit', async () => {
    const { calls } = fixture();
    await requestCancellation(seller, 'contract', 'Buyer changed procurement schedule');
    expect(calls.some((c) => c.sql.startsWith('UPDATE batch_holdings'))).toBe(false);
    expect(
      calls.find((c) => c.sql.includes('INSERT INTO audit_events'))?.values?.slice(0, 3),
    ).toEqual([seller.id, seller.organizationId, 'contract.cancellation.request']);
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });
  it('identical request retry does not create another request/audit', async () => {
    const { calls } = fixture({ pending: true });
    await requestCancellation(seller, 'contract', 'Buyer changed procurement schedule');
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });
  it('the requester cannot approve its own cancellation', async () => {
    const { calls } = fixture();
    await expect(reviewCancellation(seller, 'contract', 'request', true)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });
  it('approval releases exactly the existing holding and leaves listings/history intact', async () => {
    const { calls } = fixture();
    await reviewCancellation(buyer, 'contract', 'request', true);
    expect(calls.find((c) => c.sql.startsWith('UPDATE batch_holdings'))?.values).toEqual([
      'holding',
    ]);
    expect(calls.some((c) => /^(UPDATE|DELETE|INSERT).*listings/.test(c.sql))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
    expect(calls.find((c) => c.sql.startsWith('UPDATE platform_fee_invoices'))?.sql).toContain(
      "status='estimated'",
    );
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });
  it.each([
    'paymentActivity',
    'securityActivity',
    'transportActivity',
    'issueActivity',
    'feeActivity',
  ] as const)('approval rechecks changed %s', async (flag) => {
    const { calls } = fixture({ facts: { [flag]: true } });
    await expect(reviewCancellation(buyer, 'contract', 'request', true)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });
  it('cannot release recalled inventory', async () => {
    const { calls } = fixture({ held: true });
    await expect(reviewCancellation(buyer, 'contract', 'request', true)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });
  it('rejection leaves stock and payment obligations unchanged', async () => {
    const { calls } = fixture();
    await reviewCancellation(buyer, 'contract', 'request', false);
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).length).toBe(1);
    expect(calls.find((c) => c.sql.startsWith('UPDATE'))?.sql).toContain(
      'contract_cancellation_requests',
    );
  });
  it('approved retry does not release stock or void fees a second time', async () => {
    const { calls } = fixture({ status: 'approved', facts: { status: 'cancelled' } });
    await reviewCancellation(buyer, 'contract', 'request', true);
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });
  it('audit failure rolls back cancellation and releases the connection', async () => {
    const { calls, client } = fixture({ auditFailure: true });
    await expect(reviewCancellation(buyer, 'contract', 'request', true)).rejects.toThrow(
      'audit failed',
    );
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.some((c) => c.sql === 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('rejects inaccessible contracts and invalid explanations', async () => {
    fixture({ missing: true });
    await expect(
      requestCancellation(seller, 'contract', 'Reason with enough detail'),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(requestCancellation(seller, 'contract', '🙂🙂🙂🙂🙂')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(requestCancellation(seller, 'contract', 'short')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
