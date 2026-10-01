import { describe, expect, it } from 'vitest';
import type { Knex } from 'knex';
import { SCHEMA_BASELINE_MIGRATIONS, planBaselineAndForwardMigrations } from './migrationBaseline';
import { runSafeMigrations, validateExistingMigrationHistory } from './migrationBootstrap';

const files = [...SCHEMA_BASELINE_MIGRATIONS, '011_first_forward.ts', '012_second_forward.ts'];
const plan = planBaselineAndForwardMigrations(files);

describe('safe migration history policy', () => {
  it('accepts a complete frozen baseline and preserves an ordered forward prefix', () => {
    expect(() => validateExistingMigrationHistory([...plan.baseline], plan)).not.toThrow();
    expect(() => validateExistingMigrationHistory([...plan.baseline, plan.forward[0]], plan)).not.toThrow();
    expect(() => validateExistingMigrationHistory(files, plan)).not.toThrow();
  });

  it('refuses to mark a missing historical migration as applied', () => {
    expect(() => validateExistingMigrationHistory([], plan)).toThrow(/incomplete frozen baseline/);
    expect(() => validateExistingMigrationHistory(plan.baseline.slice(0, -1), plan)).toThrow(/incomplete frozen baseline/);
  });

  it('rejects duplicate, unknown and noncanonical ledger names', () => {
    expect(() => validateExistingMigrationHistory([...files, files[0]], plan)).toThrow(/duplicate names/);
    expect(() => validateExistingMigrationHistory([...files, '099_unknown.ts'], plan)).toThrow(/unknown or noncanonical/);
    expect(() => validateExistingMigrationHistory(files.map((name) => name.replace('.ts', '.js')), plan))
      .toThrow(/unknown or noncanonical/);
  });

  it('rejects a gap before an already applied forward migration', () => {
    expect(() => validateExistingMigrationHistory([...plan.baseline, plan.forward[1]], plan)).toThrow(/gap/);
  });

  it('rejects nontransactional migration modules before acquiring a database transaction', async () => {
    let touchedDatabase = false;
    const db = { transaction: () => { touchedDatabase = true; } } as unknown as Knex;
    await expect(runSafeMigrations(db, {
      schemaSql: '', migrationFiles: files,
      loadMigration: async () => ({ config: { transaction: false } }),
    })).rejects.toThrow(/separately reviewed deployment strategy/);
    expect(touchedDatabase).toBe(false);
  });
});
