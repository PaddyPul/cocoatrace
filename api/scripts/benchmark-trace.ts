import { performance } from 'node:perf_hooks';
import { calculateTraceForward, TraceGraph } from '../src/services/recallTrace';
import { TRACE_LIMITS } from '../src/modules/trace/limits';

const graph: TraceGraph = {
  lots: Array.from({ length: TRACE_LIMITS.lots }, (_, index) => ({
    id: String(index),
    lotCode: String(index),
    lotType: 'production',
    productName: 'Benchmark material',
    quantityKg: index === 0 ? TRACE_LIMITS.lots - 1 : 1,
  })),
  edges: Array.from({ length: TRACE_LIMITS.lots - 1 }, (_, index) => ({
    id: String(index),
    sourceLotId: '0',
    destinationLotId: String(index + 1),
    allocatedInputKg: 1,
    allocationMethod: 'declared',
  })),
  distributions: Array.from({ length: TRACE_LIMITS.distributions }, (_, index) => ({
    id: String(index),
    lotId: '1',
    recipientOrganizationId: String(index),
    recipientName: 'Benchmark recipient',
    quantityKg: 0.001,
    distributionReference: String(index),
    dispatchedAt: '2026-10-07',
  })),
};
// Spread deliveries across leaves, retaining physically valid quantities.
graph.distributions.forEach((item, index) => {
  item.lotId = String(1 + (index % (TRACE_LIMITS.lots - 1)));
});
const samples: number[] = [];
for (let index = 0; index < 10; index++) {
  const start = performance.now();
  const result = calculateTraceForward(graph, [{ lotId: '0' }]);
  samples.push(performance.now() - start);
  if (result.analysis.status !== 'complete' || result.impactedLots.length !== TRACE_LIMITS.lots)
    throw new Error('Incomplete benchmark result');
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      fixture: {
        lots: graph.lots.length,
        edges: graph.edges.length,
        distributions: graph.distributions.length,
      },
      runs: samples.length,
      medianMs: Number(samples[5].toFixed(2)),
      maxMs: Number(samples[9].toFixed(2)),
      calculationBudgetMs: TRACE_LIMITS.calculationMs,
      scope: 'Synthetic in-memory calculation only; not a hosted PostgreSQL capacity claim',
    },
    null,
    2,
  ),
);
