import { beforeEach, describe, expect, it, vi } from 'vitest';
const dependencies = vi.hoisted(() => ({ query: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock('../trading/transaction', () => ({
  inTradeTransaction: dependencies.transaction,
  recordTradeAudit: dependencies.audit,
}));
import { createFarm, createPlot } from './commands';
const actor = { id: 'user', organizationId: 'organization' };
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.transaction.mockImplementation(async (work) => work({ query: dependencies.query }));
});
describe('farm mutation use cases', () => {
  it('returns the complete inserted farm and audits with the same transaction client', async () => {
    const row = { id: 'farm', verification_status: 'self_declared', created_at: new Date() };
    dependencies.query.mockResolvedValue({ rows: [row] });
    expect(
      await createFarm(actor, {
        name: 'Farm',
        country: 'GH',
        region: 'Region',
        district: 'District',
      }),
    ).toBe(row);
    expect(dependencies.query.mock.calls[0][1]).toEqual([
      'organization',
      'Farm',
      'GH',
      'Region',
      'District',
      null,
      null,
      null,
    ]);
    expect(dependencies.audit).toHaveBeenCalledWith(
      { query: dependencies.query },
      actor,
      'farm.create',
      'farm',
      'farm',
      { claimSource: 'supplier_declaration' },
    );
  });
  it('does not insert or audit a plot when the locked farm is outside the actor organization', async () => {
    dependencies.query.mockResolvedValue({ rows: [] });
    expect(
      await createPlot(actor, 'farm', {
        plotCode: 'P1',
        areaHectares: 1,
        crops: ['cocoa'],
        geolocationSource: 'farmer_submitted',
      }),
    ).toBeNull();
    expect(dependencies.query).toHaveBeenCalledExactlyOnceWith(
      'SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2 FOR SHARE',
      ['farm', 'organization'],
    );
    expect(dependencies.audit).not.toHaveBeenCalled();
  });
});
