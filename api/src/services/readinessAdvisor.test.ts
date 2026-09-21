import { describe, expect, it } from 'vitest';
import { adviseReadiness } from './readinessAdvisor';

describe('readiness advisor', () => {
  it('puts an active recall ahead of commercial readiness work', () => {
    const result = adviseReadiness({ batchesTotal: 2, batchesAttested: 2, productsTotal: 1, productsPublished: 1, productsWithEvidence: 1, activeRecalls: 1, shipmentsInProgress: 0 });
    expect(result.score).toBe(100);
    expect(result.recommendations[0].priority).toBe('urgent');
    expect(result.recommendations[0].path).toBe('/recalls');
  });

  it('explains the first useful action for an empty workspace', () => {
    const result = adviseReadiness({ batchesTotal: 0, batchesAttested: 0, productsTotal: 0, productsPublished: 0, productsWithEvidence: 0, activeRecalls: 0, shipmentsInProgress: 0 });
    expect(result.score).toBe(0);
    expect(result.recommendations.map((item) => item.path)).toEqual(['/batches', '/products']);
  });

  it('does not call a clean record a legal compliance decision', () => {
    const result = adviseReadiness({ batchesTotal: 1, batchesAttested: 1, productsTotal: 1, productsPublished: 1, productsWithEvidence: 1, activeRecalls: 0, shipmentsInProgress: 1 });
    expect(result.recommendations[0].detail).toContain('not a legal compliance determination');
  });
});
