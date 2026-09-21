import { describe, expect, it } from 'vitest';
import { calculateTraceBack, calculateTraceForward, TraceGraph } from './recallTrace';

const graph: TraceGraph = {
  lots: [
    { id: 's1', lotCode: 'SOURCE-1', lotType: 'source', productName: 'Beans', quantityKg: 10000 },
    { id: 's2', lotCode: 'SOURCE-2', lotType: 'source', productName: 'Beans', quantityKg: 8000 },
    { id: 'p1', lotCode: 'LIQUOR-1', lotType: 'production', productName: 'Liquor', quantityKg: 9000 },
    { id: 'f1', lotCode: 'PACK-A', lotType: 'packaging', productName: 'Chocolate', quantityKg: 4000 },
    { id: 'f2', lotCode: 'PACK-B', lotType: 'packaging', productName: 'Chocolate', quantityKg: 3800 },
  ],
  edges: [
    { id: 'e1', sourceLotId: 's1', destinationLotId: 'p1', allocatedInputKg: 6000, allocationMethod: 'declared' },
    { id: 'e2', sourceLotId: 's2', destinationLotId: 'p1', allocatedInputKg: 4000, allocationMethod: 'declared' },
    { id: 'e3', sourceLotId: 'p1', destinationLotId: 'f1', allocatedInputKg: 4200, allocationMethod: 'declared' },
    { id: 'e4', sourceLotId: 'p1', destinationLotId: 'f2', allocatedInputKg: 4000, allocationMethod: 'declared' },
  ],
  distributions: [
    { id: 'd1', lotId: 'f1', recipientOrganizationId: 'r1', recipientName: 'Retailer', quantityKg: 2500, distributionReference: 'D-1', dispatchedAt: '2024-01-01' },
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
      edges: graph.edges.map((edge) => edge.id === 'e1' ? { ...edge, allocationMethod: 'proportional' } : edge),
    };
    const result = calculateTraceForward(estimated, [{ lotId: 's1' }]);
    expect(result.exactness).toBe('estimated');
    expect(result.impactedLots.find((lot) => lot.id === 'f1')!.allocationConfidence).toBe('estimated');
  });

  it('rejects a quantity greater than the recorded lot', () => {
    expect(() => calculateTraceBack(graph, { lotId: 'f1', quantityKg: 4001 })).toThrow(/exceeds lot PACK-A/);
  });
});
