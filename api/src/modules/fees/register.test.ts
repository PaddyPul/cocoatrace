import { describe, expect, it, vi } from 'vitest';
import { feeFilters, feeRegister } from './register';
const actor = {
  id: 'user',
  organizationId: '11111111-1111-4111-8111-111111111111',
  permissions: [],
};
const rows = [1, 2].map((number) => ({
  id: `22222222-2222-4222-8222-22222222222${number}`,
  created_key: '1792774800.123456',
}));
describe('scoped paged platform fee register', () => {
  it('applies tenant, receipt-review, literal search and inclusive UTC date filters before limit', async () => {
    const execute = vi.fn().mockResolvedValue({ rows });
    const page = await feeRegister(execute, actor, {
      limit: '1',
      search: '%_',
      review: 'pending',
      from: '2026-10-01',
      to: '2026-10-23',
    });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('f.payer_organization_id=$1::uuid');
    expect(sql).toContain("fs.status='submitted'");
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain("INTERVAL '1 day'");
    expect(params).toEqual([
      actor.organizationId,
      false,
      'all',
      'pending',
      '2026-10-01',
      '2026-10-23',
      '%_',
      '%\\%\\_%',
      null,
      null,
      2,
    ]);
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    await feeRegister(execute, actor, {
      limit: '1',
      search: '%_',
      review: 'pending',
      from: '2026-10-01',
      to: '2026-10-23',
      cursor: page.nextCursor,
    });
    expect(execute.mock.calls[1][1].slice(8, 10)).toEqual(['1792774800.123456', rows[0].id]);
    for (const changed of [
      { ...actor, organizationId: rows[0].id },
      { ...actor, permissions: ['finance.manage'] },
    ])
      await expect(
        feeRegister(execute, changed, {
          limit: '1',
          search: '%_',
          review: 'pending',
          from: '2026-10-01',
          to: '2026-10-23',
          cursor: page.nextCursor,
        }),
      ).rejects.toThrow('Invalid page cursor');
  });
  it('rejects malformed filters, dates and cursor before issuing a query', async () => {
    const execute = vi.fn();
    for (const parameters of [
      { status: 'anything' },
      { review: ['pending'] },
      { from: '2026-02-30' },
      { from: '2026-10-23', to: '2026-10-01' },
      { cursor: 'broken' },
      { limit: '101' },
    ])
      await expect(feeRegister(execute, actor, parameters)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
    expect(feeFilters({})).toEqual({ status: 'all', review: 'all', from: '', to: '' });
  });
});
