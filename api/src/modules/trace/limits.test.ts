import { describe, expect, it } from 'vitest';
import { TRACE_LIMITS, TraceBudget, TraceIncompleteError } from './limits';

describe('trace analysis budgets', () => {
  it('reports incomplete work without a safety clearance', () => {
    try {
      new TraceBudget().step(TRACE_LIMITS.work + 1);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(TraceIncompleteError);
      expect((error as TraceIncompleteError).analysis).toEqual({
        status: 'incomplete',
        reason: 'WORK_LIMIT',
        safetyClearance: false,
      });
    }
  });
  it('enforces elapsed time independently of work using a monotonic clock', () => {
    let clock = 0;
    const budget = new TraceBudget(20, () => clock);
    clock = 21;
    expect(() => budget.step(0)).toThrow(/TIME_LIMIT/);
  });
  it('enforces maximum depth without recursion', () => {
    expect(() => new TraceBudget().step(1, TRACE_LIMITS.depth + 1)).toThrow(/DEPTH_LIMIT/);
  });
});
