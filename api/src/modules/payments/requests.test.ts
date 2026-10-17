import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentPlan } from '../../services/paymentProtection';
const db = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('../../db', () => db);
import { createPaymentRequest } from './requests';
import {
  assertRequestCanBeCreated,
  assertRequestMoney,
  paymentStateAfterAgreement,
} from './requestPolicy';

const actor = { id: 'seller-user', organizationId: 'seller-org' };
const cases: [PaymentPlan, string, number, string][] = [
  ['pay_before_dispatch', 'payment_due', 101, 'not_required'],
  ['deposit_balance', 'payment_due', 20.2, 'not_required'],
  ['bank_secured', 'awaiting_security', 0, 'awaiting_submission'],
  ['documentary_collection', 'awaiting_documents', 0, 'not_required'],
  ['pay_after_delivery', 'awaiting_delivery', 0, 'not_required'],
];
function fixture(
  options: {
    plan?: PaymentPlan;
    status?: string;
    terms?: string;
    missing?: boolean;
    existing?: boolean;
    auditFailure?: boolean;
    minorUnits?: number;
    total?: string;
  } = {},
) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT * FROM sales_contracts'))
      return {
        rows: options.missing
          ? []
          : [
              {
                id: 'contract',
                status: options.status ?? 'accepted',
                payment_plan: options.plan ?? 'deposit_balance',
                currency: 'EUR',
                currency_minor_units: options.minorUnits ?? 2,
                deposit_percentage: '20',
                payment_terms_status: options.terms ?? 'agreed',
                payment_terms_confirmed_at: '2026-10-01T00:00:00Z',
              },
            ],
      };
    if (sql.startsWith('SELECT id FROM payment_requests'))
      return { rows: options.existing ? [{ id: 'existing' }] : [] };
    if (sql.startsWith('SELECT ROUND')) return { rows: [{ total: options.total ?? '101.00' }] };
    if (sql.startsWith('INSERT INTO payment_requests'))
      return {
        rows: [
          {
            id: 'payment',
            status: 'awaiting_terms',
            amount_total: options.total ?? '101.00',
            currency: 'EUR',
          },
        ],
      };
    if (sql.startsWith('INSERT INTO audit_events') && options.auditFailure)
      throw new Error('audit unavailable');
    return { rows: [] };
  });
  const release = vi.fn();
  db.getClient.mockResolvedValue({ query, release });
  return { calls, release };
}
beforeEach(() => vi.clearAllMocks());

describe('payment request creation domain boundary', () => {
  it.each(cases)(
    'initializes %s without changing its agreed state or dispatch requirement',
    async (plan, state, dispatch, security) => {
      const { calls, release } = fixture({ plan });
      expect(paymentStateAfterAgreement(plan)).toBe(state);
      expect(
        await createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' }),
      ).toMatchObject({ id: 'payment', status: 'awaiting_terms' });
      expect(calls.find((c) => c.sql.startsWith('SELECT * FROM sales_contracts'))).toEqual({
        sql: expect.stringContaining('seller_organization_id=$2 FOR UPDATE'),
        values: ['contract', 'seller-org'],
      });
      expect(calls.find((c) => c.sql.startsWith('SELECT ROUND'))?.sql).toContain(
        'ROUND(quantity_kg*price_per_kg,currency_minor_units)',
      );
      expect(calls.find((c) => c.sql.startsWith('INSERT INTO payment_requests'))?.values).toEqual([
        'contract',
        'seller-org',
        '101.00',
        'EUR',
        plan,
        dispatch,
        security,
        2,
      ]);
      const installments = calls.filter((c) =>
        c.sql.startsWith('INSERT INTO payment_installments'),
      );
      expect(installments).toHaveLength(plan === 'deposit_balance' ? 2 : 1);
      expect(installments.every((c) => c.sql.includes("'awaiting_trigger'"))).toBe(true);
      expect(
        calls.find((c) => c.sql.startsWith('UPDATE payment_requests SET status'))?.values,
      ).toEqual([state, plan, 'payment']);
      expect(calls.find((c) => c.sql.startsWith('UPDATE payment_installments'))?.values).toEqual([
        'payment',
        'terms_agreed',
        '2026-10-01T00:00:00Z',
        0,
      ]);
      expect(calls.at(-1)?.sql).toBe('COMMIT');
      expect(release).toHaveBeenCalledOnce();
    },
  );
  it('keeps unagreed terms and every installment awaiting its trigger', async () => {
    const { calls } = fixture({ terms: 'proposed' });
    await createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' });
    expect(calls.some((c) => c.sql.startsWith('UPDATE payment'))).toBe(false);
  });
  it.each(['settled', 'cancelled'])(
    'rejects %s contracts before reading or creating a workflow',
    async (status) => {
      const { calls } = fixture({ status });
      await expect(
        createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' }),
      ).rejects.toThrow('Closed contracts');
      expect(calls.some((c) => c.sql.includes('INSERT INTO'))).toBe(false);
      expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    },
  );
  it('does not expose a contract outside the seller scope', async () => {
    const { calls } = fixture({ missing: true });
    await expect(
      createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' }),
    ).rejects.toThrow('Contract');
    expect(calls.some((c) => c.sql.includes('INSERT INTO'))).toBe(false);
  });
  it('keeps duplicate creation a conflict rather than replacing installments on retry', async () => {
    const { calls } = fixture({ existing: true });
    await expect(
      createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' }),
    ).rejects.toThrow('already exists');
    expect(calls.some((c) => c.sql.includes('INSERT INTO'))).toBe(false);
  });
  it('rolls back all writes when atomic audit insertion fails', async () => {
    const { calls, release } = fixture({ auditFailure: true });
    await expect(
      createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' }),
    ).rejects.toThrow('audit unavailable');
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.some((c) => c.sql === 'COMMIT')).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
  it.each([
    { amountTotal: 100.99, currency: 'EUR' },
    { amountTotal: 101, currency: 'USD' },
  ])('rejects mismatched commercial money %j', async (input) => {
    const { calls } = fixture();
    await expect(createPaymentRequest(actor, 'contract', input)).rejects.toThrow('must match');
    expect(calls.some((c) => c.sql.includes('INSERT INTO'))).toBe(false);
  });
  it('preserves zero-decimal full payments without imposing two-decimal rounding', async () => {
    const { calls } = fixture({ plan: 'pay_before_dispatch', minorUnits: 0, total: '101' });
    await createPaymentRequest(actor, 'contract', { amountTotal: 101, currency: 'EUR' });
    expect(
      calls.find((c) => c.sql.startsWith('INSERT INTO payment_requests'))?.values?.at(-1),
    ).toBe(0);
    expect(calls.find((c) => c.sql.startsWith('INSERT INTO payment_installments'))?.values).toEqual(
      ['payment', 'full', 1, 101, 'terms_agreed', 0],
    );
  });
});

describe('request creation policy', () => {
  it('accepts exact persisted totals and an open empty workflow', () => {
    expect(() =>
      assertRequestMoney('1.005', 'EUR', { amountTotal: 1.005, currency: 'EUR' }),
    ).not.toThrow();
    expect(() => assertRequestCanBeCreated('accepted', false)).not.toThrow();
    expect(() => assertRequestCanBeCreated('accepted', true)).toThrow('already exists');
  });
});
