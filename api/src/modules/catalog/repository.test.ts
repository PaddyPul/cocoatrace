import { describe, expect, it, vi } from 'vitest';
vi.mock('../trust/assessment', () => ({
  loadBatchTrust: vi.fn(async () => new Map()),
  legacyOrganicStatus: vi.fn(),
}));
import { holdingPage, listingPage, holdingSummary } from './repository';
import { parsePage } from './paging';
describe('catalog SQL boundaries', () => {
  it('filters stock status, recall and tenant before keyset limit', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await holdingPage(
      execute,
      'tenant',
      parsePage({ search: '%_', limit: '7' }, ['tenant'], []),
      true,
    );
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('h.holder_organization_id=$1');
    expect(sql).toContain("h.status='available'");
    expect(sql).toContain('ORDER BY h.id LIMIT $6');
    expect(parameters).toEqual(['tenant', null, true, '%_', '%\\%\\_%', 8]);
  });
  it('filters commodity, evidence, own supplier, origin and exact ID before ordered limit', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await listingPage(
      execute,
      'tenant',
      parsePage({ sort: 'quantity' }, ['tenant'], [], ['id', 'quantity']),
      {
        mine: true,
        commodity: 'raw shea nuts',
        origin: '%_',
        minimum: '35',
        organic: true,
        id: 'id',
        currency: '',
      },
    );
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('l.seller_organization_id=$1');
    expect(sql).toContain("c.status='active'");
    expect(sql).toContain('c.farmer_organization_id=cf.farmer_organization_id');
    expect(sql).toContain('ORDER BY l.available_quantity_kg DESC,l.id DESC LIMIT $12');
    expect(parameters.slice(6)).toEqual(['shea', '%_', '%\\%\\_%', '35', true, 51, 'id', '']);
  });
  it('types every cursor parameter for default ID order even without a numeric sort key', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await listingPage(execute, 'tenant', parsePage({}, ['tenant'], []), {
      mine: false,
      commodity: '',
      origin: '',
      minimum: '0',
      organic: false,
      id: '',
      currency: '',
    });
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('(l.id>$3::uuid AND $2::numeric IS NULL)');
    expect(parameters[1]).toBeNull();
    for (let index = 1; index <= parameters.length; index++) {
      expect(sql).toMatch(new RegExp('\\$' + index + '(?![0-9])'));
    }
  });
  it('assesses recall once per tenant batch before aggregating totals', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 0, available_count: 0, available_kg: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await holdingSummary(execute, 'tenant')).toEqual({
      count: 0,
      available_count: 0,
      available_kg: '0',
      commodities: [],
    });
    const [sql, parameters] = execute.mock.calls[0];
    expect(sql).toContain('stock AS MATERIALIZED');
    expect(sql).toContain('assessed AS MATERIALIZED');
    expect(sql).toContain('WHERE h.holder_organization_id=$1 GROUP BY h.batch_id');
    expect(sql).toContain('FILTER (WHERE NOT held)');
    expect(sql.match(/SELECT 1 FROM recall_notices/g)).toHaveLength(1);
    expect(parameters).toEqual(['tenant']);
  });
  it('does not invent a partial commodity summary', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 5000 }] })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 101 }, (_, n) => ({ commodity: String(n) })),
      });
    await expect(holdingSummary(execute, 'tenant')).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
