import {
  TRACE_LIMITS,
  TraceBudget,
  TraceIncompleteError,
  checkTraceSize,
} from '../modules/trace/limits';
import { ValidationError } from '../errors';

export type TraceLot = {
  id: string;
  lotCode: string;
  lotType: 'source' | 'production' | 'packaging';
  productName: string;
  quantityKg: number;
  batchId?: string | null;
  ownerName?: string | null;
  ownerOrganizationId?: string;
  status?: string;
  producedAt?: string;
  sourceMode?: 'farm_traceable' | 'direct_inventory' | null;
  sourceLabel?: string | null;
  downstreamLotCount?: number;
  distributionCount?: number;
};

export type TraceEdge = {
  id: string;
  sourceLotId: string;
  destinationLotId: string;
  allocatedInputKg: number;
  allocationMethod: 'declared' | 'proportional';
  eventCode?: string;
  eventType?: string;
};

export type TraceDistribution = {
  id: string;
  lotId: string;
  recipientOrganizationId: string;
  recipientName: string;
  quantityKg: number;
  distributionReference: string;
  shipmentId?: string | null;
  dispatchedAt: string;
};

export type TraceGraph = {
  lots: TraceLot[];
  edges: TraceEdge[];
  distributions: TraceDistribution[];
};

type Seed = { lotId: string; quantityKg?: number };

export class TraceCalculationError extends ValidationError {}

const round = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function indexes(graph: TraceGraph, budget: TraceBudget) {
  checkTraceSize(graph.lots.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
  checkTraceSize(graph.edges.length, TRACE_LIMITS.edges, 'EDGES_LIMIT');
  checkTraceSize(graph.distributions.length, TRACE_LIMITS.distributions, 'DISTRIBUTIONS_LIMIT');
  budget.step(graph.lots.length + graph.edges.length + graph.distributions.length);
  const ids = new Set(graph.lots.map((lot) => lot.id));
  if (
    ids.size !== graph.lots.length ||
    graph.lots.some((lot) => !Number.isFinite(lot.quantityKg) || lot.quantityKg <= 0)
  )
    throw new TraceIncompleteError('INVALID_GRAPH');
  const lots = new Map(graph.lots.map((lot) => [lot.id, lot]));
  const incoming = new Map<string, TraceEdge[]>();
  const outgoing = new Map<string, TraceEdge[]>();
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) throw new TraceIncompleteError('INVALID_GRAPH');
    edgeIds.add(edge.id);
    if (!lots.has(edge.sourceLotId) || !lots.has(edge.destinationLotId)) {
      throw new TraceIncompleteError('INVALID_GRAPH');
    }
    if (!Number.isFinite(edge.allocatedInputKg) || edge.allocatedInputKg <= 0)
      throw new TraceIncompleteError('INVALID_GRAPH');
    if (!incoming.has(edge.destinationLotId)) incoming.set(edge.destinationLotId, []);
    if (!outgoing.has(edge.sourceLotId)) outgoing.set(edge.sourceLotId, []);
    incoming.get(edge.destinationLotId)!.push(edge);
    outgoing.get(edge.sourceLotId)!.push(edge);
  }
  return { lots, incoming, outgoing };
}

function assertAcyclic(graph: TraceGraph, outgoing: Map<string, TraceEdge[]>, budget: TraceBudget) {
  const indegree = new Map(graph.lots.map((lot) => [lot.id, 0]));
  for (const edge of graph.edges)
    indegree.set(edge.destinationLotId, indegree.get(edge.destinationLotId)! + 1);
  const queue = graph.lots.filter((lot) => indegree.get(lot.id) === 0).map((lot) => lot.id);
  const depths = new Map(queue.map((id) => [id, 0]));
  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    budget.step(1, depths.get(id)!);
    visited++;
    for (const edge of outgoing.get(id) || []) {
      budget.step();
      depths.set(
        edge.destinationLotId,
        Math.max(depths.get(edge.destinationLotId) || 0, depths.get(id)! + 1),
      );
      indegree.set(edge.destinationLotId, indegree.get(edge.destinationLotId)! - 1);
      if (indegree.get(edge.destinationLotId) === 0) queue.push(edge.destinationLotId);
    }
  }
  if (visited !== graph.lots.length) throw new TraceIncompleteError('CYCLE');
}

function validateSeed(lots: Map<string, TraceLot>, seed: Seed): number {
  const lot = lots.get(seed.lotId);
  if (!lot) throw new TraceCalculationError(`Lot ${seed.lotId} not found`);
  const quantity = seed.quantityKg ?? lot.quantityKg;
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new TraceCalculationError('Trace quantity must be positive');
  if (quantity > lot.quantityKg + 0.001)
    throw new TraceCalculationError(`Trace quantity exceeds lot ${lot.lotCode} quantity`);
  return quantity;
}

function graphWarnings(
  graph: TraceGraph,
  outgoing: Map<string, TraceEdge[]>,
  budget: TraceBudget,
): string[] {
  const lotMap = new Map(graph.lots.map((lot) => [lot.id, lot]));
  const warnings: string[] = [];
  for (const [sourceId, edges] of outgoing) {
    const allocated = edges.reduce((sum, edge) => sum + edge.allocatedInputKg, 0);
    const lot = lotMap.get(sourceId)!;
    if (allocated > lot.quantityKg + 0.001) {
      warnings.push(
        `Allocated output from ${lot.lotCode} exceeds its recorded quantity by ${round(allocated - lot.quantityKg)} kg`,
      );
    }
  }
  if (graph.edges.some((edge) => edge.allocationMethod === 'proportional')) {
    warnings.push(
      'At least one relationship uses a proportional estimate rather than a declared allocation',
    );
  }
  const distributedByLot = new Map<string, number>();
  const distributionIds = new Set<string>();
  for (const item of graph.distributions) {
    budget.step();
    if (distributionIds.has(item.id)) throw new TraceIncompleteError('INVALID_GRAPH');
    distributionIds.add(item.id);
    if (!lotMap.has(item.lotId) || !Number.isFinite(item.quantityKg) || item.quantityKg <= 0)
      throw new TraceIncompleteError('INVALID_GRAPH');
    distributedByLot.set(item.lotId, (distributedByLot.get(item.lotId) || 0) + item.quantityKg);
  }
  for (const lot of graph.lots) {
    budget.step();
    const distributed = distributedByLot.get(lot.id) || 0;
    if (distributed > lot.quantityKg + 0.001) {
      warnings.push(
        `Distribution from ${lot.lotCode} exceeds its recorded quantity by ${round(distributed - lot.quantityKg)} kg`,
      );
    }
  }
  return warnings;
}

export function calculateTraceBack(graph: TraceGraph, seed: Seed) {
  const budget = new TraceBudget();
  const { lots, incoming, outgoing } = indexes(graph, budget);
  assertAcyclic(graph, outgoing, budget);
  const queryQuantityKg = validateSeed(lots, seed);
  const quantities = new Map<string, number>([[seed.lotId, queryQuantityKg]]);
  const depths = new Map<string, number>([[seed.lotId, 0]]);
  const partialQuery = queryQuantityKg < lots.get(seed.lotId)!.quantityKg - 0.001;
  const methods = new Map<string, Set<string>>([
    [seed.lotId, new Set([partialQuery ? 'proportional' : 'direct'])],
  ]);
  const queue: Array<{ lotId: string; deltaKg: number; depth: number }> = [
    { lotId: seed.lotId, deltaKg: queryQuantityKg, depth: 0 },
  ];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    budget.step(1, current.depth);
    const destination = lots.get(current.lotId)!;
    for (const edge of incoming.get(current.lotId) || []) {
      budget.step();
      const source = lots.get(edge.sourceLotId)!;
      const destinationFraction = Math.min(1, current.deltaKg / destination.quantityKg);
      const requested = edge.allocatedInputKg * destinationFraction;
      const existing = quantities.get(source.id) || 0;
      const added = Math.max(0, Math.min(requested, source.quantityKg - existing));
      if (added <= 0.000001) continue;
      quantities.set(source.id, existing + added);
      depths.set(source.id, Math.max(depths.get(source.id) || 0, current.depth + 1));
      const sourceMethods = methods.get(source.id) || new Set<string>();
      for (const method of methods.get(destination.id) || []) sourceMethods.add(method);
      sourceMethods.add(edge.allocationMethod);
      methods.set(source.id, sourceMethods);
      queue.push({ lotId: source.id, deltaKg: added, depth: current.depth + 1 });
    }
  }

  const tracedLots = [...quantities.entries()]
    .map(([lotId, quantityRequiredKg]) => {
      const lot = lots.get(lotId)!;
      const lotMethods = [...(methods.get(lotId) || [])];
      return {
        ...lot,
        quantityRequiredKg: round(quantityRequiredKg),
        percentOfLot: round((quantityRequiredKg / lot.quantityKg) * 100),
        relationshipDepth: depths.get(lotId) || 0,
        allocationConfidence: lotMethods.includes('proportional') ? 'estimated' : 'declared',
      };
    })
    .sort(
      (a, b) => b.relationshipDepth - a.relationshipDepth || a.lotCode.localeCompare(b.lotCode),
    );

  const sourceLots = tracedLots.filter((lot) => !(incoming.get(lot.id) || []).length);
  return {
    analysis: budget.summary(),
    direction: 'trace-back' as const,
    targetLot: lots.get(seed.lotId),
    queryQuantityKg: round(queryQuantityKg),
    tracedLots,
    sourceLots,
    exactness: tracedLots.some((lot) => lot.allocationConfidence === 'estimated')
      ? 'estimated'
      : 'declared',
    warnings: [
      ...graphWarnings(graph, outgoing, budget),
      ...(partialQuery
        ? ['A partial target quantity is allocated proportionally across its recorded inputs']
        : []),
    ],
    assumptions: [
      'Declared edge quantities are treated as the exact input assigned to each destination lot.',
      'A partial output query consumes the same fraction of every declared input allocation for that output lot.',
    ],
  };
}

export function calculateTraceForward(graph: TraceGraph, seeds: Seed[]) {
  const budget = new TraceBudget();
  const { lots, incoming, outgoing } = indexes(graph, budget);
  assertAcyclic(graph, outgoing, budget);
  checkTraceSize(seeds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
  if (!seeds.length) throw new TraceCalculationError('At least one suspect lot is required');

  const totalInputs = new Map<string, number>();
  for (const [id, edges] of incoming)
    totalInputs.set(
      id,
      edges.reduce((sum, edge) => sum + edge.allocatedInputKg, 0),
    );
  const equivalent = new Map<string, number>();
  const recallQuantity = new Map<string, number>();
  const depths = new Map<string, number>();
  const methods = new Map<string, Set<string>>();
  const queue: Array<{ lotId: string; deltaKg: number; depth: number }> = [];

  for (const seed of seeds) {
    const quantity = validateSeed(lots, seed);
    const existing = equivalent.get(seed.lotId) || 0;
    const added = Math.max(0, Math.min(quantity, lots.get(seed.lotId)!.quantityKg - existing));
    if (added <= 0) continue;
    equivalent.set(seed.lotId, existing + added);
    recallQuantity.set(seed.lotId, lots.get(seed.lotId)!.quantityKg);
    depths.set(seed.lotId, 0);
    methods.set(
      seed.lotId,
      new Set([quantity < lots.get(seed.lotId)!.quantityKg - 0.001 ? 'proportional' : 'direct']),
    );
    queue.push({ lotId: seed.lotId, deltaKg: added, depth: 0 });
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    budget.step(1, current.depth);
    const source = lots.get(current.lotId)!;
    for (const edge of outgoing.get(current.lotId) || []) {
      budget.step();
      const destination = lots.get(edge.destinationLotId)!;
      const totalDestinationInput = totalInputs.get(destination.id) || 0;
      if (totalDestinationInput <= 0) continue;
      const affectedAllocation =
        edge.allocatedInputKg * Math.min(1, current.deltaKg / source.quantityKg);
      const destinationDelta =
        destination.quantityKg * (affectedAllocation / totalDestinationInput);
      const existing = equivalent.get(destination.id) || 0;
      const added = Math.max(0, Math.min(destinationDelta, destination.quantityKg - existing));
      if (added <= 0.000001) continue;
      equivalent.set(destination.id, existing + added);
      // Any suspect contribution to a commingled descendant puts the entire
      // destination lot in recall scope, even though equivalent quantity stays precise.
      recallQuantity.set(destination.id, destination.quantityKg);
      depths.set(destination.id, Math.max(depths.get(destination.id) || 0, current.depth + 1));
      const destinationMethods = methods.get(destination.id) || new Set<string>();
      for (const method of methods.get(source.id) || []) destinationMethods.add(method);
      destinationMethods.add(edge.allocationMethod);
      methods.set(destination.id, destinationMethods);
      queue.push({ lotId: destination.id, deltaKg: added, depth: current.depth + 1 });
    }
  }

  const impactedLots = [...equivalent.entries()]
    .map(([lotId, sourceEquivalentKg]) => {
      const lot = lots.get(lotId)!;
      const lotMethods = [...(methods.get(lotId) || [])];
      return {
        ...lot,
        sourceEquivalentKg: round(sourceEquivalentKg),
        sourceEquivalentPercent: round((sourceEquivalentKg / lot.quantityKg) * 100),
        recallQuantityKg: round(recallQuantity.get(lotId) || lot.quantityKg),
        relationshipDepth: depths.get(lotId) || 0,
        allocationConfidence: lotMethods.includes('proportional') ? 'estimated' : 'declared',
      };
    })
    .sort(
      (a, b) => a.relationshipDepth - b.relationshipDepth || a.lotCode.localeCompare(b.lotCode),
    );

  const impactedIds = new Set(impactedLots.map((lot) => lot.id));
  const leafLots = impactedLots.filter(
    (lot) => !(outgoing.get(lot.id) || []).some((edge) => impactedIds.has(edge.destinationLotId)),
  );
  const impactedDistributions = graph.distributions
    .filter((distribution) => impactedIds.has(distribution.lotId))
    .map((distribution) => ({ ...distribution, recallQuantityKg: round(distribution.quantityKg) }));
  const recipientMap = new Map<
    string,
    { organizationId: string; name: string; recallQuantityKg: number; distributionCount: number }
  >();
  for (const item of impactedDistributions) {
    budget.step();
    const recipient = recipientMap.get(item.recipientOrganizationId) || {
      organizationId: item.recipientOrganizationId,
      name: item.recipientName,
      recallQuantityKg: 0,
      distributionCount: 0,
    };
    recipient.recallQuantityKg += item.recallQuantityKg;
    recipient.distributionCount++;
    recipientMap.set(item.recipientOrganizationId, recipient);
  }
  const recipients = [...recipientMap.values()].map((item) => ({
    ...item,
    recallQuantityKg: round(item.recallQuantityKg),
  }));

  return {
    analysis: budget.summary(),
    direction: 'trace-forward' as const,
    suspectLots: seeds.map((seed) => ({
      ...lots.get(seed.lotId)!,
      queryQuantityKg: round(seed.quantityKg ?? lots.get(seed.lotId)!.quantityKg),
    })),
    impactedLots,
    leafLots,
    impactedDistributions,
    recipients,
    totals: {
      impactedLotCount: impactedLots.length,
      leafRecallQuantityKg: round(leafLots.reduce((sum, lot) => sum + lot.recallQuantityKg, 0)),
      distributedRecallQuantityKg: round(
        impactedDistributions.reduce((sum, item) => sum + item.recallQuantityKg, 0),
      ),
      recipientCount: recipients.length,
    },
    exactness: impactedLots.some((lot) => lot.allocationConfidence === 'estimated')
      ? 'estimated'
      : 'declared',
    warnings: [
      ...graphWarnings(graph, outgoing, budget),
      ...(seeds.some(
        (seed) =>
          (seed.quantityKg ?? lots.get(seed.lotId)!.quantityKg) <
          lots.get(seed.lotId)!.quantityKg - 0.001,
      )
        ? [
            "A partial suspect quantity is spread proportionally across the lot's recorded allocations",
          ]
        : []),
    ],
    assumptions: [
      'Source-equivalent quantity follows declared mass allocations through each transformation.',
      'A partial suspect quantity is proportionally distributed because identity below the lot level is not recorded.',
      'Any non-zero suspect contribution places the full commingled descendant lot in recall scope.',
      'Recall totals use terminal impacted lots to avoid double-counting intermediate material.',
    ],
  };
}
