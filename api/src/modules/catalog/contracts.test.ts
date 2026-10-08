import { describe, expect, it, vi } from 'vitest';
import { contractPage, contractSummary, legacyContracts } from './contracts';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222';
describe('party-scoped contract pages', () => {
  it('filters before limiting, escapes search and types every parameter', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await contractPage(execute, org, {
      direction: 'sales',
      status: 'active',
      search: '%_',
      limit: '3',
    });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain('c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid');
    expect(sql).toContain("c.status NOT IN ('settled','cancelled')");
    expect(sql).toContain('ORDER BY c.id LIMIT $7::int');
    expect(sql).toContain('ROUND(c.quantity_kg*c.price_per_kg,c.currency_minor_units)');
    expect(values).toEqual([org, null, 'sales', 'active', '%_', '%\\%\\_%', 4]);
    for (let n = 1; n <= 7; n++) expect(sql).toContain('$' + n + '::');
  });
  it('binds cursor to filters and party', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: org }] });
    const page = await contractPage(execute, org, { limit: '1' });
    await expect(
      contractPage(execute, org, { cursor: page.nextCursor, status: 'active' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(contractPage(execute, id, { cursor: page.nextCursor })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it.each([
    { limit: '101' },
    { direction: 'foreign' },
    { status: 'invalid' },
    { search: 'x'.repeat(81) },
  ])('validates input %j', async (input) => {
    await expect(contractPage(vi.fn(), org, input)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('summarizes all statuses with bounded latest active lookup', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 1005, active_count: 1003 }] })
      .mockResolvedValueOnce({ rows: [{ id }] });
    expect(await contractSummary(execute, org)).toMatchObject({
      count: 1005,
      active_count: 1003,
      latest_active_id: id,
    });
    expect(execute.mock.calls[0][0]).not.toContain('LIMIT');
    expect(execute.mock.calls[1][0]).toContain('ORDER BY c.created_at DESC,c.id DESC LIMIT 1');
  });
  it('returns null shortcut for empty workspace', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 0, active_count: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    expect((await contractSummary(execute, org)).latest_active_id).toBeNull();
  });
  it('refuses legacy overflow', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyContracts(execute, org)).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
