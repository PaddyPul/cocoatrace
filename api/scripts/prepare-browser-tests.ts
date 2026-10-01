import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import knex from 'knex';
import { config } from '../src/config/env';
import { requireDisposableTestDatabase } from '../src/testing/databaseSafety';
import { planBaselineAndForwardMigrations } from '../src/testing/migrationBaseline';

async function prepare(): Promise<void> {
  requireDisposableTestDatabase(config.databaseUrl);
  if (config.environment !== 'test' || process.env.BROWSER_TEST_FIXTURES !== 'true'
      || new URL(config.databaseUrl).pathname !== '/cocoatrace_browser_test') {
    throw new Error('Browser preparation may reset only the explicitly enabled browser test database');
  }
  execFileSync(process.execPath, [path.join(__dirname, 'check-migration-integrity.mjs')], { stdio: 'inherit' });
  const db = knex({ client: 'pg', connection: config.databaseUrl });
  try {
    await db.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    // Frozen db/schema.sql is the schema through migration 010. Do not replay
    // migrations 001-010 on top of that snapshot. This mirrors the API harness.
    await db.raw(fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8'));
    const directory = path.resolve(__dirname, '../src/migrations');
    const files = fs.readdirSync(directory).filter((name) => name.endsWith('.ts')).sort();
    const plan = planBaselineAndForwardMigrations(files);
    await db.schema.createTable('knex_migrations', (table) => {
      table.increments('id').primary(); table.string('name'); table.integer('batch'); table.timestamp('migration_time');
    });
    await db.schema.createTable('knex_migrations_lock', (table) => {
      table.increments('index').primary(); table.integer('is_locked');
    });
    await db('knex_migrations_lock').insert({ is_locked: 0 });
    await db('knex_migrations').insert(plan.baseline.map((name) => ({ name, batch: 1, migration_time: new Date() })));
    const [, applied] = await db.migrate.latest({ migrationSource: {
      getMigrations: async () => files,
      getMigrationName: (name: string) => name,
      getMigration: async (name: string) => import(pathToFileURL(path.join(directory, name)).href),
    } });
    if (JSON.stringify([...applied].sort()) !== JSON.stringify([...plan.forward].sort())) {
      throw new Error('Browser forward migration plan did not match the applied migrations');
    }
    console.log('Disposable browser database prepared from frozen baseline and forward migrations');
  } finally { await db.destroy(); }
}
prepare().catch((error) => { console.error(error.message); process.exitCode = 1; });
