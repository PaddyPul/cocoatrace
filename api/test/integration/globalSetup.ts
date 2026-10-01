import fs from 'fs';
import path from 'path';
import knex, { Knex } from 'knex';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import { planBaselineAndForwardMigrations } from '../../src/testing/migrationBaseline';

let database: Knex | undefined;

export async function setup(): Promise<void> {
  const connection = requireDisposableTestDatabase(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  );

  process.env.DATABASE_URL = connection;

  database = knex({
    client: 'pg',
    connection,
    pool: { min: 0, max: 2 },
  });

  await database.raw('SELECT 1');

  // The database is disposable and name-guarded above. Recreating public makes
  // repeated local runs deterministic and prevents stale objects hiding a bad
  // forward migration.
  await database.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public');

  const migrationDirectory = path.resolve(__dirname, '../../src/migrations');
  const migrationFiles = fs.readdirSync(migrationDirectory)
    .filter((name) => name.endsWith('.ts'))
    .sort();
  const migrationPlan = planBaselineAndForwardMigrations(migrationFiles);

  const baselineSchema = fs.readFileSync(
    path.resolve(__dirname, './baselines/010_schema.sql'),
    'utf8',
  );
  await database.raw(baselineSchema);

  await database.schema.createTable('knex_migrations', (table) => {
    table.increments('id').primary();
    table.string('name');
    table.integer('batch');
    table.timestamp('migration_time');
  });
  await database.schema.createTable('knex_migrations_lock', (table) => {
    table.increments('index').primary();
    table.integer('is_locked');
  });
  await database('knex_migrations_lock').insert({ is_locked: 0 });
  await database('knex_migrations').insert(
    migrationPlan.baseline.map((name) => ({
      name,
      batch: 1,
      migration_time: new Date('2026-09-29T00:00:00.000Z'),
    })),
  );

  const migrationModulesByPath = import.meta.glob('../../src/migrations/*.ts', { eager: true }) as Record<string, {
    up: Knex.Migration['up'];
    down?: Knex.Migration['down'];
  }>;
  const migrationModules = migrationPlan.forward.map((name) => {
    const migration = migrationModulesByPath[`../../src/migrations/${name}`];
    if (!migration) throw new Error(`Migration module was not loaded by Vitest: ${name}`);
    return { name, ...migration };
  });
  const migrationSource: Knex.MigrationSource<{ name: string; up: Knex.Migration['up']; down?: Knex.Migration['down'] }> = {
    getMigrations: async () => migrationModules,
    getMigrationName: (migration) => migration.name,
  };
  const [, appliedForwardMigrations] = await database.migrate.latest({ migrationSource });
  const expectedForward = [...migrationPlan.forward].sort();
  const appliedForward = [...appliedForwardMigrations].sort();
  if (JSON.stringify(appliedForward) !== JSON.stringify(expectedForward)) {
    throw new Error(
      `Expected forward migrations [${expectedForward.join(', ')}], but Knex applied [${appliedForward.join(', ')}].`,
    );
  }

  const tables = await database('pg_tables')
    .select('tablename')
    .where({ schemaname: 'public' })
    .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock']);

  if (tables.length > 0) {
    const identifiers = tables.map(({ tablename }) => `"${String(tablename).replace(/"/g, '""')}"`);
    await database.raw(`TRUNCATE TABLE ${identifiers.join(', ')} RESTART IDENTITY CASCADE`);
  }
}

export async function teardown(): Promise<void> {
  await database?.destroy();
  database = undefined;
}
