import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_BASELINE_MIGRATIONS,
  planBaselineAndForwardMigrations,
} from './migrationBaseline';

describe('integration migration baseline', () => {
  it('matches every historical migration currently represented by baseline 010', () => {
    const migrationDirectory = path.resolve(__dirname, '../migrations');
    const discovered = fs.readdirSync(migrationDirectory).filter((name) => name.endsWith('.ts')).sort();

    const plan = planBaselineAndForwardMigrations(discovered);
    expect(plan.baseline).toEqual([...INTEGRATION_BASELINE_MIGRATIONS]);
    expect([...plan.baseline, ...plan.forward].sort()).toEqual(discovered);
  });

  it('classifies newly appended migrations as forward migrations', () => {
    const next = '011_secure_evidence_storage.ts';
    const plan = planBaselineAndForwardMigrations([...INTEGRATION_BASELINE_MIGRATIONS, next]);
    expect(plan.forward).toEqual([next]);
  });

  it('fails when a historical baseline migration disappears', () => {
    const incomplete = INTEGRATION_BASELINE_MIGRATIONS.filter((name) => name !== '009_supplier_paths_and_real_sourcing.ts');
    expect(() => planBaselineAndForwardMigrations([...incomplete])).toThrow(/missing migrations.*009_/);
  });

  it('rejects retroactively numbered migrations outside the frozen baseline', () => {
    expect(() => planBaselineAndForwardMigrations([
      ...INTEGRATION_BASELINE_MIGRATIONS,
      '009_unreviewed_retroactive_change.ts',
    ])).toThrow(/retroactive files/);
  });
});
