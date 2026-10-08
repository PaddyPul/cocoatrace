import { describe, expect, it, vi } from 'vitest';
import { plotPage, plotSummary, farmPlotCollection } from './farmPlots';
const actor = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: ['farm.read'],
};
const id = '22222222-2222-2222-2222-222222222222';
const allowed = () =>
  vi.fn().mockImplementation(async (sql: string) => ({
    rows: sql.includes('SELECT EXISTS')
      ? [{ allowed: true }]
      : sql === 'SELECT id FROM farms WHERE id=$1::uuid'
        ? [{ id }]
        : [],
  }));
describe('bounded farm plots', () => {
  it('rechecks farm access and literal search before limiting', async () => {
    const execute = allowed();
    await plotPage(execute, actor, id, { search: '%_', limit: '2' });
    expect(execute.mock.calls.at(-1)?.[0]).toContain('ORDER BY id LIMIT $5::int');
    expect(execute.mock.calls).toHaveLength(3);
  });
  it('denies unrelated farms before plot reads', async () => {
    const execute = vi.fn().mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT EXISTS') ? [{ allowed: false }] : [{ id }],
    }));
    await expect(plotPage(execute, actor, id, {})).rejects.toMatchObject({ statusCode: 403 });
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it('validates search and totals and never uses generic analytics as a read-all grant', async () => {
    await expect(plotPage(allowed(), actor, id, { limit: '101' })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(plotSummary(allowed(), actor, id, { search: 'x' })).rejects.toMatchObject({
      statusCode: 400,
    });
    const execute = allowed();
    await plotSummary(execute, { ...actor, permissions: ['analytics.read.network'] }, id, {});
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it('paged farm responses skip arrays; legacy reads refuse overflow', async () => {
    const execute = vi.fn();
    expect(await farmPlotCollection(execute, id, 'paged')).toEqual({
      plots: null,
      plot_collection: 'paged',
    });
    expect(execute).not.toHaveBeenCalled();
    await expect(
      farmPlotCollection(
        vi.fn().mockResolvedValue({ rows: Array(1001).fill({ id }) }),
        id,
        undefined,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(farmPlotCollection(execute, id, 'all')).rejects.toMatchObject({ statusCode: 400 });
  });
});
