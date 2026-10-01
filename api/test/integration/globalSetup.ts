import fs from 'fs';
import path from 'path';
import knex, { Knex } from 'knex';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import { up as applyIdentitySessionLifecycle } from '../../src/migrations/016_identity_session_lifecycle';

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
  const baselineSchema = fs.readFileSync(path.resolve(__dirname, '../../../db/schema.sql'), 'utf8');
  await database.raw(baselineSchema);
  await applyIdentitySessionLifecycle(database);

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
