import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../db';
import { loadTradeActions } from './tradeActionRepository';
vi.mock('../db', () => ({ query: vi.fn() }));
const mockedQuery = vi.mocked(query);
beforeEach(() => {
  mockedQuery.mockReset();
});
describe('permission-scoped shared action reads', () => {
  it('performs no commercial query without the matching read permissions', async () => {
    expect(await loadTradeActions({ organizationId: 'org', permissions: [] })).toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
  it('a contract read uses organization and contract parameters and does not fetch offers', async () => {
    mockedQuery.mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
    await loadTradeActions(
      { organizationId: 'org', permissions: ['contract.read', 'offer.create'] },
      'contract',
    );
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [sql, parameters] = mockedQuery.mock.calls[0];
    expect(parameters).toEqual(['org', 'contract']);
    expect(sql).toContain('(c.seller_organization_id=$1 OR c.buyer_organization_id=$1)');
    expect(sql).toContain('($2::uuid IS NULL OR c.id=$2)');
    expect(sql).toContain("status='awaiting_trigger' AND due_trigger='documents_presented'");
    expect(sql).toContain('recall_safety_holds');
  });
  it('offer-only access cannot query contracts and retains party-scoped offer parameters', async () => {
    mockedQuery.mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
    await loadTradeActions({ organizationId: 'org', permissions: ['offer.create'] });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain(
      '(o.buyer_organization_id=$1 OR l.seller_organization_id=$1)',
    );
    expect(mockedQuery.mock.calls[0][1]).toEqual(['org']);
  });
  it('propagates a failed read rather than reporting an empty successful action list', async () => {
    mockedQuery.mockRejectedValue(new Error('Database unavailable'));
    await expect(
      loadTradeActions({ organizationId: 'org', permissions: ['contract.read'] }),
    ).rejects.toThrow('Database unavailable');
  });
});
