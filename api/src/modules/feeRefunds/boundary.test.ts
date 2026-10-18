import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { assertNoFeeRefundHold } from './boundary';
import { feeRefundFingerprint, hasConfirmedFeeRefund } from './service';
describe('refund commitment boundary', () => {
  it('blocks requested, sent and confirmed refunds without testing fee policy first', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'refund' }] });
    await expect(
      assertNoFeeRefundHold({ query } as unknown as PoolClient, 'contract'),
    ).rejects.toMatchObject({ code: 'FEE_REFUND_HOLD' });
    expect(query.mock.calls[0][0]).toContain("r.status IN('requested','sent','confirmed')");
  });
  it('allows unrelated trades and rejected requests to retain their normal gates', async () => {
    await expect(
      assertNoFeeRefundHold(
        { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient,
        'contract',
      ),
    ).resolves.toBeUndefined();
  });
  it('permits cancellation fee exception only for an unchanged confirmed full receipt', async () => {
    const fee = {
      id: 'fee',
      contract_id: 'trade',
      amount_total: '1.00',
      currency: 'EUR',
      currency_minor_units: 2,
      rate_bps: 200,
      payer_organization_id: 'seller',
      status: 'paid',
      paid_at: 'date',
      verified_by_user_id: 'finance',
      platform_receipt_reference: 'original',
      policy_version: 'seller-predispatch-v3',
    };
    const refund = {
      snapshot_fingerprint: feeRefundFingerprint(fee),
      payer_organization_id: 'seller',
      currency: 'EUR',
      amount: '1.000',
    };
    const db = (row: object) =>
      ({
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [fee] })
          .mockResolvedValueOnce({ rows: [row] }),
      }) as unknown as PoolClient;
    expect(await hasConfirmedFeeRefund(db(refund), 'trade')).toBe(true);
    for (const changed of [
      { snapshot_fingerprint: '0'.repeat(64) },
      { amount: '0.99' },
      { currency: 'USD' },
      { payer_organization_id: 'other' },
    ])
      expect(await hasConfirmedFeeRefund(db({ ...refund, ...changed }), 'trade')).toBe(false);
  });
});
