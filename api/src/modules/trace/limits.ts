import { performance } from 'node:perf_hooks';
import { AppError } from '../../errors';

export const TRACE_LIMITS = Object.freeze({
  lots: 2_000,
  edges: 8_000,
  distributions: 8_000,
  seeds: 100,
  depth: 128,
  work: 200_000,
  calculationMs: 250,
  databaseMs: 5_000,
  activationMs: 10_000,
  statementMs: 2_000,
});

export type IncompleteReason =
  | 'LOTS_LIMIT'
  | 'EDGES_LIMIT'
  | 'DISTRIBUTIONS_LIMIT'
  | 'SEEDS_LIMIT'
  | 'DEPTH_LIMIT'
  | 'WORK_LIMIT'
  | 'TIME_LIMIT'
  | 'DATABASE_TIMEOUT'
  | 'CYCLE'
  | 'INVALID_GRAPH';

export class TraceIncompleteError extends AppError {
  readonly analysis: { status: 'incomplete'; reason: IncompleteReason; safetyClearance: false };
  constructor(reason: IncompleteReason) {
    super(
      `Trace analysis incomplete (${reason}). No safety clearance is established. Keep suspect material isolated and escalate to the recall manager; no partial recall was activated.`,
      422,
      'TRACE_ANALYSIS_INCOMPLETE',
    );
    this.analysis = { status: 'incomplete', reason, safetyClearance: false };
  }
}

export function checkTraceSize(count: number, limit: number, reason: IncompleteReason) {
  if (count > limit) throw new TraceIncompleteError(reason);
}

export class TraceBudget {
  private work = 0;
  private readonly started: number;
  constructor(
    private readonly maxMs: number = TRACE_LIMITS.calculationMs,
    private readonly now = () => performance.now(),
  ) {
    this.started = now();
  }
  step(count = 1, depth = 0) {
    this.work += count;
    if (depth > TRACE_LIMITS.depth) throw new TraceIncompleteError('DEPTH_LIMIT');
    if (this.work > TRACE_LIMITS.work) throw new TraceIncompleteError('WORK_LIMIT');
    if (this.now() - this.started > this.maxMs) throw new TraceIncompleteError('TIME_LIMIT');
  }
  summary() {
    this.step(0);
    return { status: 'complete' as const, workUnits: this.work, safetyClearance: false as const };
  }
}
