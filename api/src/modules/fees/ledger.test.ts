import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('../../db', () => db);
import { statement, submitFee, reviewFee, writeOffFee } from './ledger';
import { requireCollectible, textInput } from './policy';
const payer = {
  id: 'payer-user',
  organizationId: 'seller',
  permissions: ['offer.respond', 'contract.read'],
};
const admin = { id: 'admin-user', organizationId: 'platform', permissions: ['finance.manage'] };
function fixture(
  options: {
    status?: string;
    contractStatus?: string;
    pending?: boolean;
    submissionStatus?: string;
    reference?: string;
    reason?: string;
    missing?: boolean;
    amountMatch?: boolean;
    used?: boolean;
    auditFailure?: boolean;
    zero?: boolean;
  } = {},
) {
  const f = {
    id: 'fee',
    contract_id: 'contract',
    status: options.status ?? 'invoiced',
    contract_status: options.contractStatus ?? 'settled',
    payer_organization_id: 'seller',
    amount_total: options.zero ? '0.00' : '12.50',
    currency: 'EUR',
  };
  const s = {
    id: 'submission',
    fee_id: 'fee',
    status: options.submissionStatus ?? 'submitted',
    reference: options.reference ?? 'PAYER-BANK',
    rejection_reason: options.reason ?? null,
  };
  const calls: { sql: string; values?: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT id FROM sales_contracts'))
        return { rows: options.missing ? [] : [{ id: 'contract' }] };
      if (sql.includes('SELECT f.id,f.contract_id')) return { rows: options.missing ? [] : [f] };
      if (sql.startsWith('SELECT id,fee_id')) return { rows: options.pending ? [s] : [] };
      if (sql.startsWith('SELECT * FROM platform_fee_submissions')) return { rows: [s] };
      if (sql.startsWith('SELECT id FROM platform_fee_invoices WHERE id='))
        return { rows: options.amountMatch === false ? [] : [{ id: 'fee' }] };
      if (sql.includes('lower(trim(platform_receipt_reference))'))
        return { rows: options.used ? [{ id: 'other-fee' }] : [] };
      if (sql.startsWith('SELECT write_off_reason'))
        return { rows: [{ write_off_reason: options.reason }] };
      if (sql.startsWith('INSERT INTO platform_fee_submissions')) return { rows: [s] };
      if (sql.startsWith('UPDATE platform_fee_submissions'))
        return { rows: [{ ...s, status: values?.[1] }] };
      if (sql.startsWith('UPDATE platform_fee_invoices')) return { rows: [f] };
      if (sql.includes('INSERT INTO audit_events') && options.auditFailure)
        throw new Error('audit unavailable');
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  db.getClient.mockResolvedValue(client);
  return { calls, client };
}
beforeEach(() => vi.resetAllMocks());
describe('fee collection policy and transaction boundary', () => {
  it.each(['estimated', 'paid', 'void', 'written_off'])('does not collect %s fees', (status) =>
    expect(() =>
      requireCollectible({
        status,
        contract_status: 'settled',
        amount_total: '1.00',
        payer_organization_id: 'seller',
      }),
    ).toThrow(),
  );
  it('blocks incomplete trade, unresolved payer and zero fees', () => {
    for (const extra of [
      { contract_status: 'accepted' },
      { payer_organization_id: null },
      { amount_total: '0.00' },
    ])
      expect(() =>
        requireCollectible({
          status: 'invoiced',
          contract_status: 'settled',
          amount_total: '1.00',
          payer_organization_id: 'seller',
          ...extra,
        }),
      ).toThrow();
  });
  it('rejects whitespace, code-point-short reasons and overlong references', () => {
    for (const value of ['  ', 'aa', 'a'.repeat(201)])
      expect(() => textInput(value, 3, 'Reference')).toThrow();
    expect(() => textInput('😀😀😀😀😀', 10, 'Reason')).toThrow();
  });
  it('records submission and audit without marking fee paid', async () => {
    const { calls } = fixture();
    await submitFee(payer, 'contract', ' PAYER-BANK ');
    expect(calls.some((c) => c.sql.startsWith('UPDATE platform_fee_invoices'))).toBe(false);
    expect(calls.find((c) => c.sql.includes('INSERT INTO audit_events'))?.values?.[2]).toBe(
      'fee.payment.submit',
    );
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });
  it('same pending reference retry does not write another record', async () => {
    const { calls } = fixture({ pending: true });
    await submitFee(payer, 'contract', 'PAYER-BANK');
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });
  it('different pending reference is a conflict', async () => {
    fixture({ pending: true });
    await expect(submitFee(payer, 'contract', 'OTHER-BANK')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('payer membership is required even for a commercial member', async () => {
    fixture();
    await expect(
      submitFee({ ...payer, organizationId: 'buyer' }, 'contract', 'REFERENCE'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('read-only and ordinary commercial actors cannot manage finance', async () => {
    await expect(
      submitFee({ ...payer, permissions: ['contract.read'] }, 'contract', 'REFERENCE'),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      reviewFee(payer, 'contract', 'submission', {
        decision: 'reject',
        reason: 'Receipt cannot be verified',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('a platform-authorized payer cannot verify its own fee', async () => {
    fixture();
    await expect(
      reviewFee({ ...payer, permissions: ['*'] }, 'contract', 'submission', {
        decision: 'verify',
        amount: '12.50',
        currency: 'EUR',
        receiptReference: 'PLATFORM-BANK',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('uses exact database amount/currency match and audits confirmation', async () => {
    const { calls } = fixture({ pending: true });
    await reviewFee(admin, 'contract', 'submission', {
      decision: 'verify',
      amount: '12.50',
      currency: 'EUR',
      receiptReference: 'PLATFORM-BANK',
    });
    expect(calls.find((c) => c.sql.includes('amount_total=$2::numeric'))?.values).toEqual([
      'fee',
      '12.50',
      'EUR',
    ]);
    expect(calls.some((c) => c.sql.includes("SET status='paid'"))).toBe(true);
    expect(calls.find((c) => c.sql.includes('INSERT INTO audit_events'))?.values?.[2]).toBe(
      'fee.payment.verify',
    );
  });
  it('rejects a mismatched receipt and duplicate platform bank reference', async () => {
    for (const option of [{ amountMatch: false }, { used: true }]) {
      fixture(option);
      await expect(
        reviewFee(admin, 'contract', 'submission', {
          decision: 'verify',
          amount: '12.50',
          currency: 'EUR',
          receiptReference: 'PLATFORM-BANK',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
  });
  it('verified retry returns history without mutation', async () => {
    const { calls } = fixture({ submissionStatus: 'verified', status: 'paid' });
    await reviewFee(admin, 'contract', 'submission', {
      decision: 'verify',
      amount: '12.50',
      currency: 'EUR',
      receiptReference: 'PLATFORM-BANK',
    });
    expect(calls.some((c) => c.sql.startsWith('UPDATE') || c.sql.startsWith('INSERT'))).toBe(false);
  });
  it('rejects invalid monetary input before database access', async () => {
    await expect(
      reviewFee(admin, 'contract', 'submission', {
        decision: 'verify',
        amount: '1e2',
        currency: 'EUR',
        receiptReference: 'PLATFORM-BANK',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.getClient).not.toHaveBeenCalled();
  });
  it('rejection retains fee due and writes attributable audit', async () => {
    const { calls } = fixture();
    await reviewFee(admin, 'contract', 'submission', {
      decision: 'reject',
      reason: 'Bank receipt could not be found',
    });
    expect(calls.some((c) => c.sql.startsWith('UPDATE platform_fee_invoices'))).toBe(false);
    expect(calls.find((c) => c.sql.includes('INSERT INTO audit_events'))?.values?.[2]).toBe(
      'fee.payment.reject',
    );
  });
  it('never revives a rejected submission', async () => {
    fixture({ submissionStatus: 'rejected' });
    await expect(
      reviewFee(admin, 'contract', 'submission', {
        decision: 'verify',
        amount: '12.50',
        currency: 'EUR',
        receiptReference: 'PLATFORM-BANK',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('write-off requires review of a pending receipt first', async () => {
    fixture({ pending: true });
    await expect(
      writeOffFee(admin, 'contract', 'Platform-approved pilot waiver'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('write-off closes fee only and never changes custody or goods payment', async () => {
    const { calls } = fixture();
    await writeOffFee(admin, 'contract', 'Platform-approved pilot waiver');
    expect(
      calls.some((c) => /UPDATE (sales_contracts|payment_requests|batch_holdings)/.test(c.sql)),
    ).toBe(false);
    expect(calls.find((c) => c.sql.includes('INSERT INTO audit_events'))?.values?.[2]).toBe(
      'fee.write_off',
    );
  });
  it('buyer statement omits payer payment references', async () => {
    fixture({ pending: true });
    expect(
      (await statement({ ...payer, organizationId: 'buyer' }, 'contract')).submissions,
    ).toEqual([]);
  });
  it('missing and unrelated contracts return not found', async () => {
    fixture({ missing: true });
    await expect(statement(payer, 'contract')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('critical audit failure rolls confirmation back', async () => {
    const { calls } = fixture({ auditFailure: true });
    await expect(
      reviewFee(admin, 'contract', 'submission', {
        decision: 'verify',
        amount: '12.50',
        currency: 'EUR',
        receiptReference: 'PLATFORM-BANK',
      }),
    ).rejects.toThrow('audit unavailable');
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.some((c) => c.sql === 'COMMIT')).toBe(false);
  });
});

it('fee amount or payer drift blocks collection', () => {
  for (const extra of [{ amount_matches: false }, { payer_matches: false }])
    expect(() =>
      requireCollectible({
        status: 'invoiced',
        contract_status: 'settled',
        amount_total: '1.00',
        payer_organization_id: 'seller',
        ...extra,
      }),
    ).toThrow();
});
