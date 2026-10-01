// Compatibility exports for existing test harnesses. Production owns the same
// frozen schema boundary so bootstrap and regression tests cannot diverge.
export {
  SCHEMA_BASELINE_MIGRATIONS as INTEGRATION_BASELINE_MIGRATIONS,
  planBaselineAndForwardMigrations,
  type MigrationPlan,
} from '../database/migrationBaseline';
