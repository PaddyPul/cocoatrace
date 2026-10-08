import { describe, expect, it, vi } from 'vitest';
import { productPage, productSummary, legacyProducts } from './productProfiles';
const actor = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: ['batch.read'],
};
const id = '22222222-2222-2222-2222-222222222222';
describe('product register boundaries', () => {
  it('filters literal search and visibility before limit under existing party scope', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await productPage(execute, actor, { search: '%_', visibility: 'attention', limit: '2' });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).toContain('ORDER BY pp.id LIMIT $7::int');
    expect(sql).toContain('f.cooperative_organization_id=$1::uuid');
    expect(sql).toContain('c.buyer_organization_id=$1::uuid');
    expect(sql).toContain('retained.released_at IS NULL');
    expect(sql).not.toContain("review_status='approved'");
    expect(values).toEqual([actor.organizationId, false, 'attention', null, '%_', '%\\%\\_%', 3]);
  });
  it.each([
    { limit: '101' },
    { visibility: 'invented' },
    { search: 'x'.repeat(81) },
    { all: 'true' },
  ])('rejects invalid input %j', async (parameters) => {
    await expect(productPage(vi.fn(), actor, parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it('binds cursor to tenant, network grant and filter before executing queries', async () => {
    const execute = vi.fn();
    const { parsePage, pageResult } = await import('./paging');
    const cursor = pageResult(
      [{ id }, { id: actor.organizationId }],
      parsePage({ limit: '1' }, ['products', actor.organizationId, false, 'all'], ['visibility']),
    ).nextCursor;
    for (const [who, params] of [
      [actor, { visibility: 'published' }],
      [{ ...actor, organizationId: id }, {}],
      [{ ...actor, permissions: ['product_profile.read.all'] }, {}],
    ] as [typeof actor, Record<string, string>][]) {
      await expect(productPage(execute, who, { ...params, cursor })).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it('uses full scoped totals and refuses legacy overflow before trust hydration', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: [{ count: 1500, published_count: 1400, held_count: 4 }] });
    expect(await productSummary(execute, actor, {})).toEqual({
      count: 1500,
      published_count: 1400,
      held_count: 4,
    });
    expect(execute.mock.calls[0][0]).toContain('COUNT(*)');
    await expect(productSummary(execute, actor, { search: 'x' })).rejects.toMatchObject({
      statusCode: 400,
    });
    execute.mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyProducts(execute, actor, {})).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
