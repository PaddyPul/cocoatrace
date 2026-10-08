import { describe, expect, it, vi } from 'vitest';
import { recallPage, recallSummary, legacyRecalls } from './recallRecords';
const actor = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: [] as string[],
};
const id = '22222222-2222-2222-2222-222222222222';
describe('recall register pages', () => {
  it('retains issuer/participant scope and filters literal search before a limited candidate set', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await recallPage(execute, actor, {
      search: '%_',
      status: 'resolved',
      severity: 'critical',
      limit: '2',
    });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).toContain('p.organization_id=$1::uuid');
    expect(sql).toContain('ORDER BY r.id LIMIT $8::int');
    expect(sql).not.toContain('array_agg');
    expect(params).toEqual([
      actor.organizationId,
      false,
      'resolved',
      'critical',
      null,
      '%_',
      '%\\%\\_%',
      3,
    ]);
  });
  it.each([
    { limit: '101' },
    { status: 'invalid' },
    { severity: 'invalid' },
    { search: 'x'.repeat(81) },
    { all: 'true' },
  ])('rejects invalid input %j', async (parameters) => {
    await expect(recallPage(vi.fn(), actor, parameters)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('binds cursors to parties, explicit network grant and filters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: actor.organizationId }] });
    const page = await recallPage(execute, actor, { limit: '1' });
    for (const [who, params] of [
      [actor, { status: 'active' }],
      [{ ...actor, organizationId: id }, {}],
      [{ ...actor, permissions: ['recall.manage.all'] }, {}],
    ] as [typeof actor, Record<string, string>][])
      await expect(
        recallPage(execute, who, { ...params, cursor: page.nextCursor }),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('keeps complete notice totals scoped without inferring a safety release', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1500, active_count: 25 }] });
    expect(
      await recallSummary(execute, { ...actor, permissions: ['analytics.read.network'] }, {}),
    ).toEqual({ count: 1500, active_count: 25 });
    expect(execute.mock.calls[0][1]).toEqual([actor.organizationId, false]);
    expect(execute.mock.calls[0][0]).toContain('COUNT(*)');
    await expect(recallSummary(execute, actor, { search: 'x' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it('refuses legacy notice or nested metadata overflow before loading arrays', async () => {
    for (const rows of [
      Array.from({ length: 1001 }, () => ({ id, batch_count: 0, affected_lot_count: 0 })),
      [{ id, batch_count: 1001, affected_lot_count: 0 }],
    ]) {
      const execute = vi.fn().mockResolvedValue({ rows });
      await expect(legacyRecalls(execute, actor, {})).rejects.toMatchObject({
        statusCode: 422,
        code: 'CATALOG_READ_LIMIT',
      });
      expect(execute).toHaveBeenCalledTimes(1);
    }
  });
  it('preserves small legacy arrays only for the already scoped snapshot IDs', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id, batch_count: 1, affected_lot_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id, batch_ids: ['batch'], affected_lots: [] }] });
    expect(await legacyRecalls(execute, actor, {})).toEqual([
      { id, batch_count: 1, affected_lot_count: 0, batch_ids: ['batch'], affected_lots: [] },
    ]);
    expect(execute.mock.calls[1][1]).toEqual([[id]]);
  });
});
