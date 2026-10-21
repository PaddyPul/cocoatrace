import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraceQuery } from '../../services/traceGraphRepository';
const mocks = vi.hoisted(() => ({
  seeds: vi.fn(),
  accessible: vi.fn(),
  graph: vi.fn(),
  summaries: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('./readRepository', () => ({
  accessibleSeedIds: mocks.seeds,
  readLotSummaries: mocks.summaries,
}));
vi.mock('../../services/traceGraphRepository', () => ({
  accessibleTraceLotIds: mocks.accessible,
  loadTraceGraph: mocks.graph,
  withTraceRead: async <T>(read: (execute: TraceQuery) => Promise<T>) => read(mocks.execute),
}));
import { listTraceLots, readTraceBack, readTraceForward } from './readWorkflow';
const id = '00000000-0000-4000-8000-000000000001';
const actor = { organizationId: 'organization', permissions: [] };
beforeEach(() => vi.resetAllMocks());
describe('trace read workflow', () => {
  it('validates UUIDs before looking up authorization', async () => {
    await expect(readTraceBack(actor, { lotId: 'invalid' })).rejects.toThrow(
      'Lot identifiers must be UUIDs',
    );
    expect(mocks.seeds).not.toHaveBeenCalled();
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('denies an inaccessible seed before loading graph data', async () => {
    mocks.seeds.mockResolvedValue(new Set());
    await expect(readTraceForward(actor, [{ lotId: id }])).rejects.toThrow(
      'This lot is not connected to your organization',
    );
    expect(mocks.seeds).toHaveBeenCalledWith(actor.organizationId, false, [id]);
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('applies explicit network permission and delegates bounded rooted graph calculation', async () => {
    mocks.seeds.mockResolvedValue(new Set([id]));
    mocks.graph.mockResolvedValue({
      lots: [{ id, lotCode: 'SRC', lotType: 'source', productName: 'cocoa', quantityKg: 10 }],
      edges: [],
      distributions: [],
    });
    await readTraceBack(
      { ...actor, permissions: ['traceability.read.network'] },
      { lotId: id, quantityKg: 2 },
    );
    expect(mocks.seeds).toHaveBeenCalledWith(actor.organizationId, true, [id]);
    expect(mocks.graph).toHaveBeenCalledWith(undefined, [id]);
  });
  it('keeps access and bounded summaries on the same read executor', async () => {
    mocks.accessible.mockResolvedValue(new Set([id]));
    mocks.summaries.mockResolvedValue([{ id, quantity_kg: '1.250', lot_code: 'SRC' }]);
    const rows = await listTraceLots(actor);
    expect(mocks.accessible).toHaveBeenCalledWith(actor.organizationId, false, mocks.execute);
    expect(mocks.summaries).toHaveBeenCalledWith(mocks.execute, [id]);
    expect(rows[0]).toMatchObject({ id, quantityKg: 1.25, lotCode: 'SRC' });
  });
  it('avoids summary reads when no lots are accessible', async () => {
    mocks.accessible.mockResolvedValue(new Set());
    await expect(listTraceLots(actor)).resolves.toEqual([]);
    expect(mocks.summaries).not.toHaveBeenCalled();
  });
});
