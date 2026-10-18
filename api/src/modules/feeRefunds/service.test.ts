import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { feeRefundBlockedReason, feeRefundFingerprint } from './service';
const fee = {
  id: 'fee',
  contract_id: 'trade',
  amount_total: '1.00',
  currency: 'EUR',
  payer_organization_id: 'payer',
  policy_version: 'seller-predispatch-v3',
  status: 'paid',
  platform_receipt_reference: 'receipt',
  paid_at: '2026-10-18',
  verified_by_user_id: 'finance',
  receipt_verified: true,
  contract_status: 'accepted',
};
describe('full fee refund eligibility', () => {
  it('binds review to exact money, payer and verified receipt', () => {
    const original = feeRefundFingerprint(fee);
    for (const changed of [
      { amount_total: '1.01' },
      { currency: 'USD' },
      { payer_organization_id: 'other' },
      { platform_receipt_reference: 'another' },
      { verified_by_user_id: 'other' },
      { contract_id: 'other' },
    ])
      expect(feeRefundFingerprint({ ...fee, ...changed })).not.toBe(original);
  });
  it('rejects unverified receipts and closed trades before querying activity', async () => {
    const query = vi.fn();
    const client = { query } as unknown as PoolClient;
    expect(await feeRefundBlockedReason(client, { ...fee, receipt_verified: false })).toContain(
      'verified',
    );
    expect(await feeRefundBlockedReason(client, { ...fee, contract_status: 'settled' })).toContain(
      'closed',
    );
    expect(await feeRefundBlockedReason(client, { ...fee, snapshot_valid: false })).toContain(
      'reconcile',
    );
    expect(query).not.toHaveBeenCalled();
  });
  it('keeps goods, transport and safety boundaries independent', async () => {
    for (const [facts, message] of [
      [{ goods: true, transport: false, issue: false }, 'Goods'],
      [{ goods: false, transport: true, issue: false }, 'Transport'],
      [{ goods: false, transport: false, issue: true }, 'Delivery'],
    ] as const) {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [facts] }),
      } as unknown as PoolClient;
      expect(await feeRefundBlockedReason(client, fee)).toContain(message);
    }
  });
  it('locks goods and shipment rows before checking the unstarted trade', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ goods: false, transport: false, issue: false }] });
    expect(await feeRefundBlockedReason({ query } as unknown as PoolClient, fee, true)).toBeNull();
    expect(query.mock.calls[0][0]).toContain('payment_requests');
    expect(query.mock.calls[1][0]).toContain('shipments');
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
});
