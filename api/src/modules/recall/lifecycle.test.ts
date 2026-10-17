import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  persist: vi.fn(),
  configure: vi.fn(),
  accessible: vi.fn(),
  graph: vi.fn(),
  impact: vi.fn(),
  register: vi.fn(),
  audit: vi.fn(),
  query: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../trading/transaction', () => ({
  inTradeTransaction: (work: (client: { query: typeof mocks.query }) => unknown) =>
    Promise.resolve().then(() => work({ query: mocks.query })),
  recordTradeAudit: mocks.audit,
}));
vi.mock('./activationRepository', () => ({
  loadActivationSourceLots: mocks.source,
  persistRecallActivation: mocks.persist,
  configureActivationTimeout: mocks.configure,
}));
vi.mock('../../services/traceGraphRepository', () => ({
  accessibleTraceLotIds: mocks.accessible,
  loadTraceGraph: mocks.graph,
}));
vi.mock('../../services/recallTrace', () => ({ calculateTraceForward: mocks.impact }));
vi.mock('./notifications', () => ({ registerRecallParticipants: mocks.register }));
vi.mock('./safety', () => ({ lockRecallBoundary: mocks.lock }));
import { activateRecall } from './lifecycle';
const actor = { id: 'actor', organizationId: 'organization' };
const input = {
  referenceCode: 'R',
  title: 'Recall',
  reason: 'Concern',
  instructions: 'Isolate',
  severity: 'high',
  batchIds: [] as string[],
  lots: [{ lotId: 'lot' }],
};
describe('recall activation orchestration failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.source.mockResolvedValue([]);
    mocks.accessible.mockResolvedValue(new Set(['lot']));
    mocks.graph.mockResolvedValue({});
    mocks.impact.mockReturnValue({
      impactedLots: [{ id: 'lot', batchId: 'batch' }],
      analysis: { status: 'complete' },
      totals: {},
    });
    mocks.persist.mockResolvedValue({ recall: { id: 'recall' }, withdrawnListingIds: [] });
    mocks.register.mockResolvedValue(undefined);
  });
  it('refuses inaccessible seeds before loading a graph or creating holds', async () => {
    mocks.accessible.mockResolvedValue(new Set());
    await expect(activateRecall(actor, false, input)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.graph).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('rejects a selected batch without a traceable source lot', async () => {
    await expect(activateRecall(actor, true, { ...input, batchIds: ['missing'] })).rejects.toThrow(
      'no source material lot',
    );
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('propagates participant queue failure before audit and success', async () => {
    const failure = new Error('outbox unavailable');
    mocks.register.mockRejectedValueOnce(failure);
    await expect(activateRecall(actor, false, input)).rejects.toBe(failure);
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('maps database cancellation to incomplete tracing without a success audit', async () => {
    mocks.graph.mockRejectedValueOnce({ code: '57014' });
    await expect(activateRecall(actor, false, input)).rejects.toMatchObject({
      analysis: { reason: 'DATABASE_TIMEOUT', safetyClearance: false },
    });
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
