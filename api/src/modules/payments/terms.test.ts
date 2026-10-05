import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentPlan } from '../../services/paymentProtection';
const db = vi.hoisted(() => ({ getClient: vi.fn() }));
const dueDates = vi.hoisted(() => ({ activatePaymentInstallments: vi.fn() }));
vi.mock('../../db', () => db);
vi.mock('./dueDates', () => dueDates);
import { agreePaymentTerms, paymentStateAfterAgreement, proposePaymentTerms } from './terms';

const actor = { id: 'acting-user', organizationId: 'acting-organization' };
const plans: PaymentPlan[] = [
  'pay_before_dispatch',
  'deposit_balance',
  'bank_secured',
  'documentary_collection',
  'pay_after_delivery',
];
function fixture(
  options: {
    missingContract?: boolean;
    missingPayment?: boolean;
    terms?: string;
    status?: string;
    activity?: boolean;
    auditFailure?: boolean;
    plan?: PaymentPlan;
  } = {},
) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes('FROM sales_contracts'))
        return {
          rows: options.missingContract
            ? []
            : [
                {
                  id: 'contract',
                  status: options.status ?? 'accepted',
                  payment_terms_status: options.terms ?? 'draft',
                  payment_plan: options.plan ?? 'deposit_balance',
                },
              ],
        };
      if (sql.includes('FROM payment_requests'))
        return { rows: options.missingPayment ? [] : [{ id: 'payment', amount_total: '100' }] };
      if (sql.includes('SELECT 1 FROM payment_installments'))
        return { rows: options.activity ? [{ exists: 1 }] : [] };
      if (sql.includes('INSERT INTO audit_events') && options.auditFailure)
        throw new Error('audit unavailable');
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  db.getClient.mockResolvedValue(client);
  return { calls, client };
}
const proposal = { paymentPlan: 'deposit_balance' as const };
beforeEach(() => vi.resetAllMocks());

describe('transactional payment-term workflow', () => {
  it.each(plans)(
    'proposes %s with the established installment and dispatch policy',
    async (paymentPlan) => {
      const { calls, client } = fixture();
      expect(await proposePaymentTerms(actor, 'contract', { paymentPlan })).toEqual({ ok: true });
      expect(calls[0].sql).toBe('BEGIN');
      expect(calls[1].sql).toContain('seller_organization_id=$2');
      expect(calls[1].values).toEqual(['contract', actor.organizationId]);
      expect(calls[2].sql).toContain('FROM payment_requests');
      expect(calls[1].sql).toContain('FOR UPDATE');
      expect(calls[2].sql).toContain('FOR UPDATE');
      const terms = calls.find((call) =>
        call.sql.startsWith('UPDATE sales_contracts SET payment_plan'),
      )!;
      expect(terms.values).toEqual([paymentPlan, 20, 30, null, 'contract']);
      const payment = calls.find((call) => call.sql.startsWith('UPDATE payment_requests'))!;
      expect(payment.values).toEqual([
        paymentPlan,
        paymentPlan === 'pay_before_dispatch' ? 100 : paymentPlan === 'deposit_balance' ? 20 : 0,
        paymentPlan === 'bank_secured' ? 'awaiting_submission' : 'not_required',
        'payment',
      ]);
      expect(
        calls.filter((call) => call.sql.includes('INSERT INTO payment_installments')).length,
      ).toBe(paymentPlan === 'deposit_balance' ? 2 : 1);
      const audit = calls.find((call) => call.sql.includes('INSERT INTO audit_events'))!;
      expect(audit.values?.slice(0, 5)).toEqual([
        actor.id,
        actor.organizationId,
        'payment.terms.propose',
        'sales_contract',
        'contract',
      ]);
      expect(calls.at(-1)?.sql).toBe('COMMIT');
      expect(client.release).toHaveBeenCalledOnce();
    },
  );
  it('preserves explicit commercial inputs and proof requirements', async () => {
    const { calls } = fixture();
    await proposePaymentTerms(actor, 'contract', {
      ...proposal,
      depositPercentage: 35,
      creditDays: 7,
      note: 'Agreed schedule',
      paymentEvidenceRequired: true,
    });
    expect(
      calls.find((call) => call.sql.startsWith('UPDATE sales_contracts SET payment_plan'))?.values,
    ).toEqual(['deposit_balance', 35, 7, 'Agreed schedule', 'contract']);
    expect(
      calls.find((call) =>
        call.sql.startsWith('UPDATE sales_contracts SET payment_evidence_required'),
      )?.values,
    ).toEqual([true, 'contract']);
  });
  it.each([{ missingContract: true }, { missingPayment: true }])(
    'does not mutate inaccessible or incomplete workflows: %j',
    async (options) => {
      const { calls } = fixture(options);
      await expect(proposePaymentTerms(actor, 'contract', proposal)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(calls.some((call) => /^(UPDATE|DELETE|INSERT)/.test(call.sql))).toBe(false);
      expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    },
  );
  it.each([
    { terms: 'agreed' },
    { activity: true },
    { status: 'cancelled' },
    { status: 'settled' },
  ])('refuses replacement of protected terms: %j', async (options) => {
    const { calls } = fixture(options);
    await expect(proposePaymentTerms(actor, 'contract', proposal)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(calls.some((call) => /^(UPDATE|DELETE|INSERT)/.test(call.sql))).toBe(false);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });
  it.each(plans)('agreement activates the correct next state for %s', async (plan) => {
    const { calls } = fixture({ terms: 'proposed', plan });
    expect(await agreePaymentTerms(actor, 'contract')).toEqual({ ok: true });
    expect(calls[1].sql).toContain('buyer_organization_id=$2');
    expect(dueDates.activatePaymentInstallments).toHaveBeenCalledWith(
      expect.anything(),
      'payment',
      'terms_agreed',
    );
    expect(calls.find((call) => call.sql.startsWith('UPDATE payment_requests'))?.values).toEqual([
      paymentStateAfterAgreement(plan),
      plan,
      'payment',
    ]);
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });
  it('repeated agreement does not reactivate deadlines or duplicate audit events', async () => {
    const { calls } = fixture({ terms: 'agreed' });
    expect(await agreePaymentTerms(actor, 'contract')).toEqual({
      ok: true,
      alreadyConfirmed: true,
    });
    expect(dueDates.activatePaymentInstallments).not.toHaveBeenCalled();
    expect(calls.some((call) => /^(UPDATE|DELETE|INSERT)/.test(call.sql))).toBe(false);
  });
  it.each([
    { terms: 'draft' },
    { status: 'cancelled', terms: 'proposed' },
    { status: 'settled', terms: 'agreed' },
  ])('cannot agree an unproposed or closed workflow: %j', async (options) => {
    const { calls } = fixture(options);
    await expect(agreePaymentTerms(actor, 'contract')).rejects.toMatchObject({ statusCode: 409 });
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });
  it.each(['propose', 'agree'])(
    'audit failure rolls back %s and does not return success',
    async (operation) => {
      const { calls, client } = fixture({ terms: 'proposed', auditFailure: true });
      await expect(
        operation === 'propose'
          ? proposePaymentTerms(actor, 'contract', proposal)
          : agreePaymentTerms(actor, 'contract'),
      ).rejects.toThrow('audit unavailable');
      expect(calls.at(-1)?.sql).toBe('ROLLBACK');
      expect(calls.some((call) => call.sql === 'COMMIT')).toBe(false);
      expect(client.release).toHaveBeenCalledOnce();
    },
  );
});
