import { describe, expect, it, vi } from 'vitest';
import { legacyOffers, offerPage, offerSummary } from './offers';
const org = '11111111-1111-1111-1111-111111111111';
const id = '22222222-2222-2222-2222-222222222222';
describe('bounded party offer reads', () => {
  it('applies party, direction, status and literal search before the keyset limit', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await offerPage(execute, org, {
      direction: 'received',
      status: 'pending',
      search: '%_',
      limit: '3',
    });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain(
      '(l.seller_organization_id=$1::uuid OR t.buyer_organization_id=$1::uuid)',
    );
    expect(sql).toContain('ORDER BY t.id LIMIT $8::int');
    expect(values.slice(2)).toEqual([null, 'received', 'pending', '%_', '%\\%\\_%', 4]);
    for (let n = 1; n <= 8; n++) expect(sql).toMatch(new RegExp('\\$' + n + '(?![0-9])'));
    expect(sql).toContain('platform_fee_estimate');
  });
  it('binds cursor to party and filters', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: [{ id }, { id: '33333333-3333-3333-3333-333333333333' }] });
    const page = await offerPage(execute, org, { limit: '1', direction: 'sent' });
    expect(page.items).toHaveLength(1);
    for (const parameters of [
      { direction: 'received' },
      { direction: 'sent', search: 'different' },
    ])
      await expect(
        offerPage(execute, org, { ...parameters, cursor: page.nextCursor }),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([
    { direction: 'foreign' },
    { status: 'anything' },
    { limit: '101' },
    { search: 'x'.repeat(81) },
  ])('rejects invalid input %j', async (input) => {
    await expect(offerPage(vi.fn(), org, input)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('summarizes full party totals without page or search limits', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ received_count: 1005, sent_count: 0, received_pending: 1005, sent_pending: 0 }],
    });
    expect((await offerSummary(execute, org)).received_count).toBe(1005);
    const [sql, values] = execute.mock.calls[0];
    expect(sql).not.toContain('LIMIT');
    expect(sql).toContain("t.status='pending'");
    expect(values).toEqual([org]);
  });
  it('refuses legacy overflow instead of truncating', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyOffers(execute, org)).rejects.toMatchObject({ code: 'CATALOG_READ_LIMIT' });
    expect(execute.mock.calls[0][0]).toContain('LIMIT 1001');
  });
});
