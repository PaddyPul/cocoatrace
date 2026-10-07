import { describe, expect, it, vi } from 'vitest';
vi.mock('../trust/assessment', () => ({
  loadBatchTrust: vi.fn(async () => new Map()),
  legacyOrganicStatus: vi.fn(),
}));
import { batchPage, farmPage, farmSummary, legacySourceList } from './sourceRecords';
const actor = { organizationId: 'tenant', permissions: [] };
describe('source record bounded reads', () => {
  it('filters farm relations and owner selection before LIMIT and types all parameters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await farmPage(execute, actor, { owned: 'true', search: '%_', limit: '2' });
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('f.cooperative_organization_id=$1::uuid');
    expect(sql).toContain('c.certifier_organization_id=$1::uuid');
    expect(sql).toContain('NOT $3::boolean OR f.farmer_organization_id=$1::uuid');
    for (let i = 1; i <= 7; i++) expect(sql).toContain(`$${i}::`);
    expect(parameters).toEqual(['tenant', false, true, null, '%_', '%\\%\\_%', 3]);
  });
  it('retains batch holding, attestation and contract relations and farm filter before LIMIT', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await batchPage(execute, actor, { farm: '11111111-1111-1111-1111-111111111111' });
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('h.holder_organization_id=$1::uuid');
    expect(sql).toContain('a.certifier_organization_id=$1::uuid');
    expect(sql).toContain('c.buyer_organization_id=$1::uuid');
    expect(sql).toContain('b.farm_id=$7::uuid');
    for (let i = 1; i <= 8; i++) expect(sql).toContain(`$${i}::`);
    expect(parameters[6]).toBe('11111111-1111-1111-1111-111111111111');
  });
  it('binds farm cursor to live read-all scope and owned filter', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { id: '11111111-1111-1111-1111-111111111111' },
        { id: '22222222-2222-2222-2222-222222222222' },
      ],
    });
    const first = await farmPage(execute, actor, { limit: '1' });
    await expect(
      farmPage(execute, { ...actor, permissions: ['farm.read.all'] }, { cursor: first.nextCursor }),
    ).rejects.toThrow('Invalid page cursor');
    await expect(
      farmPage(execute, actor, { cursor: first.nextCursor, owned: 'true' }),
    ).rejects.toThrow('Invalid page cursor');
  });
  it('summarizes the authorized farm set without paging or expanding permissions', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005, owned_count: 1005 }] });
    expect(await farmSummary(execute, actor)).toEqual({ count: 1005, owned_count: 1005 });
    expect(execute.mock.calls[0][1]).toEqual(['tenant', false]);
  });
  it.each(['farms', 'batches'] as const)(
    'refuses oversized compatibility %s arrays',
    async (resource) => {
      const execute = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({})) });
      await expect(legacySourceList(execute, actor, resource)).rejects.toMatchObject({
        code: 'CATALOG_READ_LIMIT',
      });
    },
  );
  it('rejects invalid batch farm and malformed owned flags', async () => {
    const execute = vi.fn();
    await expect(batchPage(execute, actor, { farm: 'unknown' })).rejects.toThrow(
      'Invalid farm identifier',
    );
    await expect(farmPage(execute, actor, { owned: 'yes' })).rejects.toThrow('Invalid owned');
    expect(execute).not.toHaveBeenCalled();
  });
});
