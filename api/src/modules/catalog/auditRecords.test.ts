import { describe, expect, it, vi } from 'vitest';
import {
  auditRecordFilters,
  auditRecordPage,
  auditRecordSummary,
  legacyAuditRecords,
} from './auditRecords';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222',
  next = '33333333-3333-3333-3333-333333333333';
const actor = { organizationId: org, permissions: ['audit.read'] };
function executor(rows: Record<string, unknown>[] = []) {
  return vi
    .fn()
    .mockResolvedValueOnce({ rows })
    .mockResolvedValue({ rows: [{ count: 1005, latest_at: '2026-01-01' }] });
}
describe('bounded audit register', () => {
  it('pages lightweight IDs before hydration with literal search and complete totals', async () => {
    const execute = executor([
      { id, sort_key: '63902822400000.123456', action: 'change' },
      { id: next, sort_key: '63902822400000.123455' },
    ]);
    const result = await auditRecordPage(execute, actor, {
      limit: '1',
      search: '%_',
      entityType: 'farm',
      entityId: id,
    });
    expect(result).toMatchObject({ count: 1005, hasMore: true, items: [{ id, action: 'change' }] });
    const [sql, args] = execute.mock.calls[0];
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).toContain('ORDER BY a.occurred_at DESC,a.id DESC LIMIT $10::int');
    expect(sql).not.toContain('metadata');
    expect(args).toEqual([false, org, 'farm', id, '', null, null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[1][1]).toEqual([false, org, 'farm', id, '']);
  });
  it('keeps explicit read privilege separate from export and analytics permissions', async () => {
    for (const permission of [
      'audit.export.all',
      'analytics.read.network',
      'provenance.read.all',
    ]) {
      const execute = executor();
      await auditRecordPage(execute, { ...actor, permissions: ['audit.read', permission] });
      expect(execute.mock.calls[0][1]?.[0]).toBe(false);
    }
    const all = executor();
    await auditRecordPage(all, { ...actor, permissions: ['audit.read.all'] });
    expect(all.mock.calls[0][1]?.[0]).toBe(true);
  });
  it('binds cursor to organization, current permissions, search and exact filters', async () => {
    const first = await auditRecordPage(
      executor([
        { id, sort_key: '63902822400000' },
        { id: next, sort_key: '63902822399999' },
      ]),
      actor,
      { limit: '1' },
    );
    for (const changed of [
      { organizationId: next, permissions: actor.permissions },
      { ...actor, permissions: ['audit.read', 'audit.read.all'] },
    ])
      await expect(
        auditRecordPage(executor(), changed, { cursor: first.nextCursor! }),
      ).rejects.toMatchObject({ statusCode: 400 });
    for (const p of [{ search: 'changed' }, { action: 'change' }, { entityType: 'farm' }])
      await expect(
        auditRecordPage(executor(), actor, { cursor: first.nextCursor!, ...p }),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects an overflowing forged timestamp cursor before SQL', async () => {
    const first = await auditRecordPage(
      executor([
        { id, sort_key: '63902822400000' },
        { id: next, sort_key: '63902822399999' },
      ]),
      actor,
      { limit: '1' },
    );
    const decoded = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString());
    decoded.key = '9999999999999999';
    const execute = executor();
    await expect(
      auditRecordPage(execute, actor, {
        cursor: Buffer.from(JSON.stringify(decoded)).toString('base64url'),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects legacy overflow before hydration', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyAuditRecords(execute, actor)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toContain('SELECT a.id');
  });
  it('summarizes scoped filters without metadata or page limits', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005, latest_at: null }] });
    expect(await auditRecordSummary(execute, actor, { action: 'change' })).toEqual({
      count: 1005,
      latestAt: null,
    });
    expect(execute.mock.calls[0][0]).not.toContain('LIMIT');
  });
  it.each([
    { entityId: 'bad' },
    { entityType: ['farm', 'lot'] },
    { action: ['a', 'b'] },
    { entityType: 'bad type' },
    { offset: '0' },
  ])('rejects malformed filters %j', (input) => {
    expect(() => auditRecordFilters(input)).toThrow();
  });
});
