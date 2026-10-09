import { describe, expect, it, vi } from 'vitest';
import { legacyTransferList, transferFilters, transferPage } from './transfers';

describe('transfer read boundary', () => {
  it('filters receiving tenant, pending state and literal search before limiting and types all parameters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await transferPage(execute, 'tenant', { limit: '7', search: '%_' });
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('(ct.to_organization_id=$1::uuid OR ct.from_organization_id=$1::uuid)');
    expect(sql).toContain('ct.to_organization_id=$1::uuid');
    expect(sql).toContain('ct.status=$4::text');
    expect(sql).toContain('ORDER BY ct.id ASC LIMIT $7::int');
    expect(parameters).toEqual(['tenant', null, 'incoming', 'requested', '%_', '%\\%\\_%', 8]);
    for (let i = 1; i <= 7; i++) expect(sql).toContain(`$${i}::`);
  });
  it('binds cursors to tenant, direction, status and search', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { id: '11111111-1111-1111-1111-111111111111' },
        { id: '22222222-2222-2222-2222-222222222222' },
      ],
    });
    const page = await transferPage(execute, 'tenant', { limit: '1' });
    for (const changed of [{ direction: 'outgoing' }, { status: 'accepted' }, { search: 'new' }])
      await expect(
        transferPage(execute, 'tenant', { limit: '1', cursor: page.nextCursor, ...changed }),
      ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      transferPage(execute, 'foreign', { limit: '1', cursor: page.nextCursor }),
    ).rejects.toThrow('Invalid page cursor');
  });
  it.each([
    { direction: 'foreign' },
    { status: 'pending' },
    { direction: ['incoming'] },
    { status: ['requested'] },
  ])('rejects invalid filters %j', (parameters) => {
    expect(() => transferFilters(parameters)).toThrow();
  });
  it('caps compatibility arrays and orders by the real requested timestamp', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({})) });
    await expect(legacyTransferList(execute, 'tenant')).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).not.toContain('recall_notices');
    expect(execute.mock.calls[0][0]).toContain(
      'ORDER BY ct.requested_at DESC,ct.id DESC LIMIT 1001',
    );
  });
});

it('hydrates only scoped preflight transfer IDs and retains recall state', async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ id: 'id' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'id', activeRecall: true }] });
  expect(await legacyTransferList(execute, 'tenant')).toEqual([{ id: 'id', activeRecall: true }]);
  expect(execute.mock.calls[1][0]).toContain('recall_notices');
  expect(execute.mock.calls[1][0]).toContain(
    '(ct.to_organization_id=$1::uuid OR ct.from_organization_id=$1::uuid)',
  );
  expect(execute.mock.calls[1][1]).toEqual(['tenant', ['id']]);
});
