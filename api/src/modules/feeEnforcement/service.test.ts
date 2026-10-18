import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  assertFeeDispatch,
  assertNoOverdueFees,
  collectionPolicyVersion,
  feeTermsFingerprint,
} from './service';
function client(row: Record<string, unknown> | undefined) {
  if (row && row.terms_accepted_at && row.accepted_fingerprint === undefined)
    row = { ...row, accepted_fingerprint: feeTermsFingerprint(row) };
  const sql: string[] = [];
  return {
    sql,
    db: {
      query: async (text: string) => {
        sql.push(text);
        if (text.includes('FROM fee_refund_requests')) return { rows: [] };
        return { rows: row ? [row] : [] };
      },
    } as unknown as PoolClient,
  };
}
const valid = {
  policy_version: collectionPolicyVersion,
  snapshot_valid: true,
  terms_accepted_at: new Date(),
  amount_total: '1.00',
  receipt_verified: false,
  credit_active: false,
  waived: false,
  id: 'fee',
  currency: 'EUR',
  currency_minor_units: 2,
  rate_bps: 200,
  payer_organization_id: 'payer',
};
describe('platform fee gate', () => {
  it('does not permit changed accepted snapshots even when credit is active', async () => {
    await expect(
      assertFeeDispatch(
        client({ ...valid, credit_active: true, accepted_fingerprint: '0'.repeat(64) }).db,
        'contract',
      ),
    ).rejects.toMatchObject({ code: 'FEE_TERMS_STALE' });
  });
  it('binds the displayed money, payer, currency and terms into consent', () => {
    expect(feeTermsFingerprint(valid)).toHaveLength(64);
    for (const changed of [
      { amount_total: '2.00' },
      { currency: 'USD' },
      { rate_bps: 300 },
      { payer_organization_id: 'other' },
    ])
      expect(feeTermsFingerprint({ ...valid, ...changed })).not.toBe(feeTermsFingerprint(valid));
  });
  it('preserves a historical completion policy', async () => {
    const c = client({ policy_version: 'seller-completion-v2' });
    await expect(assertFeeDispatch(c.db, 'contract')).resolves.toBeUndefined();
  });
  it('fails closed on missing terms for a new policy', async () => {
    const c = client({ ...valid, terms_accepted_at: null });
    await expect(assertFeeDispatch(c.db, 'contract')).rejects.toMatchObject({
      code: 'FEE_TERMS_REQUIRED',
    });
  });
  it('requires a verified receipt rather than a payer reference', async () => {
    await expect(assertFeeDispatch(client(valid).db, 'contract')).rejects.toMatchObject({
      code: 'FEE_PAYMENT_REQUIRED',
    });
  });
  it.each([
    { receipt_verified: true },
    { credit_active: true },
    { waived: true },
    { amount_total: '0.00' },
  ])('allows authoritative satisfaction %j', async (extra) => {
    await expect(
      assertFeeDispatch(client({ ...valid, ...extra }).db, 'contract'),
    ).resolves.toBeUndefined();
  });
  it('rejects corrupt snapshots even with payment', async () => {
    await expect(
      assertFeeDispatch(
        client({ ...valid, snapshot_valid: false, receipt_verified: true }).db,
        'contract',
      ),
    ).rejects.toMatchObject({ code: 'FEE_SNAPSHOT_INVALID' });
  });
  it('locks organization scopes in a stable order and refuses overdue new commitments', async () => {
    const c = client({ id: 'overdue' });
    await expect(assertNoOverdueFees(c.db, ['b', 'a', 'a'])).rejects.toMatchObject({
      code: 'FEE_OVERDUE_RESTRICTION',
    });
    expect(c.sql.filter((s) => s.includes('pg_advisory_xact_lock'))).toHaveLength(2);
    expect(c.sql.at(-1)).toContain('f.amount_total>0');
  });
});

it('does not interpret an unknown fee policy as a historical exemption', async () => {
  await expect(
    assertFeeDispatch(client({ policy_version: 'unknown-future-policy' }).db, 'contract'),
  ).rejects.toMatchObject({ code: 'FEE_POLICY_UNKNOWN' });
});
