import type { Batch } from '../source/types';

export interface ProvenancePack {
  batch: Batch;
  completenessPercent: number;
  eudrReadiness: { ready: boolean };
  policyCheckResults: Array<{ rule: string; passed: boolean; warning?: boolean }>;
}
