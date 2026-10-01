import type { Knex } from 'knex';
import { planBaselineAndForwardMigrations, type MigrationPlan } from './migrationBaseline';

export type BootstrapOptions = {
  schemaSql: string;
  migrationFiles: string[];
  loadMigration: (name: string) => Promise<{ config?: { transaction?: boolean } }>;
};

export type SafeMigrationResult = {
  bootstrapped: boolean;
  batch: number;
  applied: string[];
};

// Never infer an applied migration from the presence of one column or table.
// Existing databases need a complete historical baseline and an ordered ledger.
export function validateExistingMigrationHistory(names: string[], plan: MigrationPlan): void {
  const files = [...plan.baseline, ...plan.forward];
  const known = new Set(files);
  if (new Set(names).size !== names.length) {
    throw new Error('Migration history contains duplicate names. Restore a reviewed database backup before retrying.');
  }
  if (names.some((name) => !known.has(name))) {
    throw new Error('Migration history references unknown or noncanonical filenames. Restore matching migration files; history will not be rewritten.');
  }
  const completed = new Set(names);
  if (plan.baseline.some((name) => !completed.has(name))) {
    throw new Error('Existing migration history has an incomplete frozen baseline. Restore a reviewed backup or reconcile history manually; bootstrap will not mark missing migrations as applied.');
  }
  let pendingSeen = false;
  for (const name of plan.forward) {
    if (!completed.has(name)) pendingSeen = true;
    else if (pendingSeen) {
      throw new Error('Migration history has a gap before an applied forward migration. Restore a reviewed backup; history will not be rewritten.');
    }
  }
}

async function hasPublicObjects(db: Knex.Transaction): Promise<boolean> {
  // Extension-owned objects (for example pgcrypto) do not carry application
  // data. Every other relation, routine, enum or domain blocks automatic adoption.
  const result = await db.raw(`SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype IN ('e','d','c','r','m','b','p')
      AND t.typcategory<>'A' AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
  ) AS occupied`);
  return result.rows[0].occupied === true;
}

async function initializeBaseline(db: Knex.Transaction, options: BootstrapOptions, plan: MigrationPlan): Promise<void> {
  if (await hasPublicObjects(db)) {
    throw new Error('Public schema already contains objects but has no migration history. Refusing automatic bootstrap; restore matching history from a reviewed backup. No existing schema will be adopted or reset.');
  }
  await db.raw(options.schemaSql);
  await db.schema.withSchema('public').createTable('knex_migrations', (table) => {
    table.increments('id').primary();
    table.string('name');
    table.integer('batch');
    table.timestamp('migration_time');
  });
  await db.schema.withSchema('public').createTable('knex_migrations_lock', (table) => {
    table.increments('index').primary();
    table.integer('is_locked');
  });
  await db('knex_migrations_lock').insert({ is_locked: 0 });
  await db('knex_migrations').insert(plan.baseline.map((name) => ({
    name, batch: 1, migration_time: new Date(),
  })));
}

export async function runSafeMigrations(db: Knex, options: BootstrapOptions): Promise<SafeMigrationResult> {
  const plan = planBaselineAndForwardMigrations(options.migrationFiles);
  for (const name of plan.forward) {
    const migration = await options.loadMigration(name);
    if (migration.config?.transaction === false) {
      throw new Error(`Migration ${name} disables transactions. The atomic migration runner requires a separately reviewed deployment strategy for nontransactional migrations.`);
    }
  }
  return db.transaction(async (transaction) => {
    // Knex pins this transaction and nested migration savepoints to one PG
    // connection. The transaction-scoped lock serializes concurrent starters,
    // including empty-schema inspection, and releases on success or failure.
    await transaction.raw("SET LOCAL search_path TO public, pg_catalog");
    await transaction.raw("SET LOCAL lock_timeout TO '120s'");
    await transaction.raw('SELECT pg_catalog.pg_advisory_xact_lock(1129270863, 1414677315)');
    const hasLedger = await transaction.schema.withSchema('public').hasTable('knex_migrations');
    if (hasLedger) {
      const history = await transaction('knex_migrations').select('name');
      validateExistingMigrationHistory(history.map((entry: { name: string }) => entry.name), plan);
    } else {
      await initializeBaseline(transaction, options, plan);
    }
    // Keep the normal .ts migration source and Knex validation/locking. Only the
    // verified empty database receives baseline entries; upgrades retain theirs.
    const [batch, applied] = await transaction.migrate.latest({ schemaName: 'public' });
    return { bootstrapped: !hasLedger, batch, applied };
  });
}
