// The immutable schema snapshot already includes every migration through 010.
// These names remain canonical ledger entries, including the two 002 files.
export const SCHEMA_BASELINE_MIGRATIONS = Object.freeze([
  '001_initial_schema.ts',
  '002_pilot_ready_workspace.ts',
  '002_quantity_aware_lot_genealogy.ts',
  '003_verified_sourcing.ts',
  '004_complete_first_supply_workflow.ts',
  '005_trade_fulfilment_workflow.ts',
  '006_repair_trade_fulfilment_columns.ts',
  '007_payment_protection.ts',
  '008_payment_terms_draft_default.ts',
  '009_supplier_paths_and_real_sourcing.ts',
  '010_live_traceability_wiring.ts',
]);

export type MigrationPlan = {
  baseline: string[];
  forward: string[];
};

const SCHEMA_BASELINE_VERSION = 10;

export function planBaselineAndForwardMigrations(discoveredFiles: string[]): MigrationPlan {
  const uniqueFiles = new Set(discoveredFiles);
  if (uniqueFiles.size !== discoveredFiles.length) {
    throw new Error('Duplicate migration filenames were discovered.');
  }

  const missingBaseline = SCHEMA_BASELINE_MIGRATIONS.filter((name) => !uniqueFiles.has(name));
  if (missingBaseline.length > 0) {
    throw new Error(`The schema baseline references missing migrations: ${missingBaseline.join(', ')}`);
  }

  const baselineSet = new Set<string>(SCHEMA_BASELINE_MIGRATIONS);
  const forward = discoveredFiles.filter((name) => !baselineSet.has(name)).sort();
  const boundary = SCHEMA_BASELINE_MIGRATIONS.at(-1)!;
  const retroactive = forward.filter((name) => {
    const match = /^(\d+)_/.exec(name);
    return !match || Number(match[1]) <= SCHEMA_BASELINE_VERSION;
  });
  if (retroactive.length > 0) {
    throw new Error(
      `Migrations must be appended after baseline ${boundary}; found retroactive files: ${retroactive.join(', ')}`,
    );
  }

  return {
    baseline: [...SCHEMA_BASELINE_MIGRATIONS],
    forward,
  };
}
