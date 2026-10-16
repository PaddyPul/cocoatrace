import { describe, expect, it, vi } from 'vitest';
import { loadTradeActions } from '../../services/tradeActionRepository';
describe('notification authoritative source bound', () => {
  it('bounds both source SQL queries before returning any notices', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    expect(
      await loadTradeActions(
        { organizationId: 'org', permissions: ['offer.respond', 'contract.read'] },
        undefined,
        execute,
        1000,
      ),
    ).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
    for (const [sql] of execute.mock.calls) expect(sql).toContain('LIMIT 1001');
    expect(execute.mock.calls[1][0]).toContain('(SELECT * FROM sales_contracts WHERE');
  });
  it('fails explicitly when either complete source is outside the bound', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({})) });
    await expect(
      loadTradeActions(
        { organizationId: 'org', permissions: ['offer.create'] },
        undefined,
        execute,
        1000,
      ),
    ).rejects.toMatchObject({ statusCode: 503, code: 'NOTICE_SCOPE_EXCEEDED' });
  });
  it('shares exact offer permission and tenant source predicates', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await loadTradeActions({ organizationId: 'tenant', permissions: [] }, undefined, execute, 1000);
    expect(execute).not.toHaveBeenCalled();
    await loadTradeActions(
      { organizationId: 'tenant', permissions: ['offer.create'] },
      undefined,
      execute,
      1000,
    );
    expect(execute.mock.calls[0][1]).toEqual(['tenant']);
    expect(execute.mock.calls[0][0]).toContain(
      'o.buyer_organization_id=$1 OR l.seller_organization_id=$1',
    );
  });
});
