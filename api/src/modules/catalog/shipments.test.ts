import { describe, expect, it, vi } from 'vitest';
import { shipmentPage, shipmentSummary, legacyShipments } from './shipments';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222';
describe('party scoped transport pages', () => {
  it('filters parties, directions, states, milestone and literal search before limiting', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await shipmentPage(execute, org, {
      direction: 'sales',
      status: 'active',
      milestone: 'loaded',
      search: '%_',
      limit: '3',
    });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain('c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid');
    expect(sql).toContain("c.status NOT IN ('settled','cancelled')");
    expect(sql).toContain('ORDER BY sh.id LIMIT $8::int');
    expect(sql).toContain('c.incoterm');
    expect(values).toEqual([org, null, 'sales', 'active', 'loaded', '%_', '%\\%\\_%', 4]);
    for (let n = 1; n <= 8; n++) expect(sql).toContain('$' + n + '::');
  });
  it('binds cursor to filters and party', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: org }] });
    const page = await shipmentPage(execute, org, { limit: '1' });
    await expect(
      shipmentPage(execute, org, { cursor: page.nextCursor, milestone: 'loaded' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(shipmentPage(execute, id, { cursor: page.nextCursor })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it.each([
    { limit: '101' },
    { direction: 'foreign' },
    { status: 'invalid' },
    { milestone: 'invented' },
    { search: 'x'.repeat(81) },
  ])('validates inputs %j', async (input) => {
    await expect(shipmentPage(vi.fn(), org, input)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('summarizes without loading payment rows or a partial page', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005, active_count: 1002 }] });
    expect((await shipmentSummary(execute, org)).count).toBe(1005);
    const sql = execute.mock.calls[0][0];
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('payment_requests');
    expect(sql).toContain("sh.current_milestone<>'delivered'");
  });
  it('refuses legacy overflow rather than truncating', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyShipments(execute, org)).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
