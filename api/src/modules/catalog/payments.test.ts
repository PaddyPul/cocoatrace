import { describe, expect, it, vi } from 'vitest';
import { paymentPage, paymentSummary, legacyPayments } from './payments';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222';
describe('party scoped payment pages', () => {
  it('filters parties, directions, states, currency and literal search before limiting', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await paymentPage(execute, org, {
      direction: 'sales',
      status: 'open',
      currency: 'USD',
      search: '%_',
      limit: '3',
    });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain('c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid');
    expect(sql).toContain("c.status NOT IN ('settled','cancelled')");
    expect(sql).toContain('ORDER BY p.id LIMIT $8::int');
    expect(sql).toContain('c.payment_plan');
    expect(values).toEqual([org, null, 'sales', 'open', 'USD', '%_', '%\\%\\_%', 4]);
    for (let n = 1; n <= 8; n++) expect(sql).toContain('$' + n + '::');
  });
  it('binds cursor to filters and party', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: org }] });
    const page = await paymentPage(execute, org, { limit: '1' });
    await expect(
      paymentPage(execute, org, { cursor: page.nextCursor, currency: 'USD' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(paymentPage(execute, id, { cursor: page.nextCursor })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it.each([
    { limit: '101' },
    { direction: 'foreign' },
    { status: 'invalid' },
    { currency: '12' },
    { search: 'x'.repeat(81) },
  ])('validates inputs %j', async (input) => {
    await expect(paymentPage(vi.fn(), org, input)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('summarizes without loading installment rows or a partial page', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005, open_count: 1002 }] });
    expect((await paymentSummary(execute, org)).count).toBe(1005);
    const sql = execute.mock.calls[0][0];
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('payment_installments');
    expect(sql).toContain("p.status<>'settled'");
  });
  it('refuses legacy overflow rather than truncating', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyPayments(execute, org)).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
