import { describe, expect, it } from 'vitest';
import { calculateTraceBack, calculateTraceForward, TraceGraph } from './recallTrace';

const graph: TraceGraph = {
  lots: [
    { id: 's1', lotCode: 'SOURCE-1', lotType: 'source', productName: 'Beans', quantityKg: 10000 },
    { id: 's2', lotCode: 'SOURCE-2', lotType: 'source', productName: 'Beans', quantityKg: 8000 },
    {
      id: 'p1',
      lotCode: 'LIQUOR-1',
      lotType: 'production',
      productName: 'Liquor',
      quantityKg: 9000,
    },
    {
      id: 'f1',
      lotCode: 'PACK-A',
      lotType: 'packaging',
      productName: 'Chocolate',
      quantityKg: 4000,
    },
    {
      id: 'f2',
      lotCode: 'PACK-B',
      lotType: 'packaging',
      productName: 'Chocolate',
      quantityKg: 3800,
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceLotId: 's1',
      destinationLotId: 'p1',
      allocatedInputKg: 6000,
      allocationMethod: 'declared',
    },
    {
      id: 'e2',
      sourceLotId: 's2',
      destinationLotId: 'p1',
      allocatedInputKg: 4000,
      allocationMethod: 'declared',
    },
    {
      id: 'e3',
      sourceLotId: 'p1',
      destinationLotId: 'f1',
      allocatedInputKg: 4200,
      allocationMethod: 'declared',
    },
    {
      id: 'e4',
      sourceLotId: 'p1',
      destinationLotId: 'f2',
      allocatedInputKg: 4000,
      allocationMethod: 'declared',
    },
  ],
  distributions: [
    {
      id: 'd1',
      lotId: 'f1',
      recipientOrganizationId: 'r1',
      recipientName: 'Retailer',
      quantityKg: 2500,
      distributionReference: 'D-1',
      dispatchedAt: '2024-01-01',
    },
  ],
};

describe('quantity-aware recall tracing', () => {
  it('traces a finished lot back through processing to exact declared source requirements', () => {
    const result = calculateTraceBack(graph, { lotId: 'f1' });
    expect(result.sourceLots.map((lot) => [lot.lotCode, lot.quantityRequiredKg])).toEqual([
      ['SOURCE-1', 2800],
      ['SOURCE-2', 1866.667],
    ]);
    expect(result.exactness).toBe('declared');
  });

  it('separates suspect-equivalent mass from full commingled recall quantity', () => {
    const result = calculateTraceForward(graph, [{ lotId: 's1', quantityKg: 3000 }]);
    const liquor = result.impactedLots.find((lot) => lot.id === 'p1')!;
    const packA = result.impactedLots.find((lot) => lot.id === 'f1')!;
    // 3,000 / 10,000 of SOURCE-1 is suspect. Of its 6,000 kg allocation,
    // 1,800 kg is suspect; the 9,000 / 10,000 process yield produces 1,620 kg.
    expect(liquor.sourceEquivalentKg).toBe(1620);
    expect(liquor.recallQuantityKg).toBe(9000);
    expect(packA.sourceEquivalentKg).toBe(720);
    expect(packA.recallQuantityKg).toBe(4000);
    expect(result.totals.leafRecallQuantityKg).toBe(7800);
    expect(result.totals.distributedRecallQuantityKg).toBe(2500);
    expect(result.exactness).toBe('estimated');
    expect(result.impactedLots.find((lot) => lot.id === 's1')!.recallQuantityKg).toBe(10000);
  });

  it('does not double count a shared descendant when two suspect inputs are selected', () => {
    const result = calculateTraceForward(graph, [{ lotId: 's1' }, { lotId: 's2' }]);
    const liquor = result.impactedLots.find((lot) => lot.id === 'p1')!;
    expect(liquor.sourceEquivalentKg).toBe(9000);
    expect(result.impactedLots.filter((lot) => lot.id === 'p1')).toHaveLength(1);
  });

  it('propagates proportional confidence through every later descendant', () => {
    const estimated: TraceGraph = {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === 'e1' ? { ...edge, allocationMethod: 'proportional' } : edge,
      ),
    };
    const result = calculateTraceForward(estimated, [{ lotId: 's1' }]);
    expect(result.exactness).toBe('estimated');
    expect(result.impactedLots.find((lot) => lot.id === 'f1')!.allocationConfidence).toBe(
      'estimated',
    );
  });

  it('rejects a quantity greater than the recorded lot', () => {
    expect(() => calculateTraceBack(graph, { lotId: 'f1', quantityKg: 4001 })).toThrow(
      /exceeds lot PACK-A/,
    );
  });
});

import { TRACE_LIMITS } from '../modules/trace/limits';

describe('adversarial trace graph safety', () => {
  it('rejects cycles in both directions and never emits a complete result', () => {
    const cyclic = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: 'cycle',
          sourceLotId: 'f1',
          destinationLotId: 's1',
          allocatedInputKg: 1,
          allocationMethod: 'declared' as const,
        },
      ],
    };
    expect(() => calculateTraceBack(cyclic, { lotId: 'f1' })).toThrow(/CYCLE/);
    expect(() => calculateTraceForward(cyclic, [{ lotId: 's1' }])).toThrow(/CYCLE/);
  });
  it('rejects excessive graph depth before recursive stack exhaustion', () => {
    const lots = Array.from({ length: TRACE_LIMITS.depth + 2 }, (_, id) => ({
      ...graph.lots[0],
      id: String(id),
      lotCode: String(id),
    }));
    const edges = lots.slice(1).map((lot, id) => ({
      id: `e${id}`,
      sourceLotId: String(id),
      destinationLotId: lot.id,
      allocatedInputKg: 10000,
      allocationMethod: 'declared' as const,
    }));
    expect(() =>
      calculateTraceForward({ lots, edges, distributions: [] }, [{ lotId: '0' }]),
    ).toThrow(/DEPTH_LIMIT/);
  });
  it('rejects dangling and non-finite physical records without computing scope', () => {
    expect(() =>
      calculateTraceForward(
        { ...graph, lots: graph.lots.map((lot) => ({ ...lot, quantityKg: Infinity })) },
        [{ lotId: 's1' }],
      ),
    ).toThrow(/INVALID_GRAPH/);
    expect(() =>
      calculateTraceBack({ ...graph, lots: graph.lots.slice(1) }, { lotId: 'f1' }),
    ).toThrow(/INVALID_GRAPH/);
  });
  it('enforces seed, lot, edge and distribution caps before allocation', () => {
    expect(() =>
      calculateTraceForward(
        graph,
        Array.from({ length: TRACE_LIMITS.seeds + 1 }, () => ({ lotId: 's1' })),
      ),
    ).toThrow(/SEEDS_LIMIT/);
    expect(() =>
      calculateTraceBack(
        { ...graph, lots: Array.from({ length: TRACE_LIMITS.lots + 1 }, () => graph.lots[0]) },
        { lotId: 's1' },
      ),
    ).toThrow(/LOTS_LIMIT/);
    expect(() =>
      calculateTraceBack(
        { ...graph, edges: Array.from({ length: TRACE_LIMITS.edges + 1 }, () => graph.edges[0]) },
        { lotId: 's1' },
      ),
    ).toThrow(/EDGES_LIMIT/);
    expect(() =>
      calculateTraceBack(
        {
          ...graph,
          distributions: Array.from(
            { length: TRACE_LIMITS.distributions + 1 },
            () => graph.distributions[0],
          ),
        },
        { lotId: 's1' },
      ),
    ).toThrow(/DISTRIBUTIONS_LIMIT/);
  });
  it('stops repeated convergent allocations at the work/time budget', () => {
    const lots = Array.from({ length: 50 }, (_, id) => ({
      ...graph.lots[0],
      id: String(id),
      lotCode: String(id),
      quantityKg: 1,
    }));
    const edges: TraceGraph['edges'] = [];
    for (let layer = 0; layer < 24; layer++) {
      for (const from of [2 * layer, 2 * layer + 1])
        for (const to of [2 * layer + 2, 2 * layer + 3])
          edges.push({
            id: `${from}-${to}`,
            sourceLotId: String(from),
            destinationLotId: String(to),
            allocatedInputKg: 0.5,
            allocationMethod: 'declared' as const,
          });
    }
    expect(() =>
      calculateTraceForward({ lots, edges, distributions: [] }, [{ lotId: '0' }]),
    ).toThrow(/WORK_LIMIT|TIME_LIMIT/);
  });

  it('handles pilot-capacity fan-out and distribution aggregation without high-copy scans', () => {
    const lots = Array.from({ length: TRACE_LIMITS.lots }, (_, id) => ({
      ...graph.lots[0],
      id: String(id),
      lotCode: String(id),
      quantityKg: 1,
    }));
    lots[0].quantityKg = lots.length - 1;
    const edges = lots.slice(1).map((lot) => ({
      id: `e${lot.id}`,
      sourceLotId: '0',
      destinationLotId: lot.id,
      allocatedInputKg: 1,
      allocationMethod: 'declared' as const,
    }));
    const distributions = Array.from({ length: TRACE_LIMITS.distributions }, (_, id) => ({
      ...graph.distributions[0],
      id: String(id),
      lotId: '1',
      recipientOrganizationId: `r${id}`,
      quantityKg: 0.0001,
    }));
    const result = calculateTraceForward({ lots, edges, distributions }, [{ lotId: '0' }]);
    expect(result.analysis.status).toBe('complete');
    expect(result.analysis.safetyClearance).toBe(false);
    expect(result.impactedLots).toHaveLength(TRACE_LIMITS.lots);
    expect(result.recipients).toHaveLength(TRACE_LIMITS.distributions);
  });
});
