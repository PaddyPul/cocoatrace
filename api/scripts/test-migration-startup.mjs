import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const databaseUrl = process.env.DATABASE_URL;
const target = new URL(databaseUrl || 'postgresql://invalid.invalid/invalid');
// This harness drops public repeatedly. It must never target customer storage.
if (process.env.MIGRATION_TEST_RESET !== 'I_UNDERSTAND_DISPOSABLE_DATABASE'
    || !['postgres:', 'postgresql:'].includes(target.protocol)
    || target.pathname !== '/cocoatrace_migration_test'
    || !['127.0.0.1', 'localhost', 'postgres-migration-test'].includes(target.hostname)) {
  throw new Error('Migration startup tests require the explicitly enabled, isolated cocoatrace_migration_test database');
}
if (process.env.APP_ENV !== 'production' || process.env.NODE_ENV !== 'production') {
  throw new Error('Migration startup tests must exercise the production configuration');
}
const db = new pg.Client({ connectionString: databaseUrl });
const files = fs.readdirSync(path.join(root, 'api/src/migrations')).filter((name) => name.endsWith('.ts')).sort();
const baseline = files.filter((name) => Number(name.split('_')[0]) <= 10);
const sentinelId = '11111111-1111-4111-8111-111111111111';

function migrate(expectedSuccess = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'api/scripts/migrate.ts'], {
      cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-12000);
    });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 60000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) reject(new Error('Migration subprocess exceeded 60 seconds'));
      else if ((code === 0) !== expectedSuccess) reject(new Error(`Migration subprocess unexpectedly exited ${code}: ${output}`));
      else resolve(output);
    });
  });
}
async function reset() { await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public'); }
async function ledger() {
  return (await db.query('SELECT name,batch,migration_time FROM knex_migrations ORDER BY name')).rows;
}
async function assertCompleteSchema() {
  assert.deepEqual((await ledger()).map((row) => row.name), files);
  const duplicate = await db.query('SELECT name FROM knex_migrations GROUP BY name HAVING count(*) != 1');
  assert.equal(duplicate.rowCount, 0);
  for (const relation of ['organizations', 'farms', 'harvest_batches', 'shipments', 'evidence_upload_intents', 'organization_access_applications']) {
    assert.ok((await db.query('SELECT to_regclass($1) AS relation', [`public.${relation}`])).rows[0].relation, `Missing ${relation}`);
  }
  for (const [table, column] of [['harvest_batches', 'source_mode'], ['user_invitations', 'email_delivery_status']]) {
    assert.equal((await db.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2", [table, column])).rows[0].count, 1);
  }
}
async function schemaFingerprint() {
  const relations = await db.query("SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind");
  const columns = await db.query("SELECT table_name,column_name,ordinal_position,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  const constraints = await db.query("SELECT c.conname,t.relname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' ORDER BY t.relname,c.conname");
  return { relations: relations.rows, columns: columns.rows, constraints: constraints.rows };
}
async function insertSentinel() {
  await db.query("INSERT INTO organizations(id,name,type,jurisdiction) VALUES($1,'Preserve migration test customer','exporter','GH')", [sentinelId]);
}
async function assertSentinel() {
  assert.deepEqual((await db.query('SELECT id,name,type,jurisdiction FROM organizations WHERE id=$1', [sentinelId])).rows,
    [{ id: sentinelId, name: 'Preserve migration test customer', type: 'exporter', jurisdiction: 'GH' }]);
}
async function existingBaseline() {
  await reset();
  await db.query(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
  await db.query('CREATE TABLE knex_migrations (id serial PRIMARY KEY,name varchar(255),batch integer,migration_time timestamp); CREATE TABLE knex_migrations_lock (index serial PRIMARY KEY,is_locked integer); INSERT INTO knex_migrations_lock(is_locked) VALUES(0)');
  for (const name of baseline) await db.query('INSERT INTO knex_migrations(name,batch,migration_time) VALUES($1,1,$2)', [name, new Date('2025-01-01T00:00:00Z')]);
  await insertSentinel();
}
async function assertProductionServerStarts() {
  const child = spawn(process.execPath, ['api/dist/server.js'], {
    cwd: root, env: { ...process.env, PORT: '13101' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { output = (output + chunk.toString()).slice(-3000); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Production API exited during startup: ${output}`);
      let response;
      try { response = await fetch('http://127.0.0.1:13101/health'); }
      catch { /* API socket is not ready yet. */ }
      if (response?.ok) {
        assert.deepEqual(await response.json(), { status: 'ok', db: 'connected' });
        const liveness = await fetch('http://127.0.0.1:13101/health/live');
        assert.equal((await liveness.json()).environment, 'production');
        ready = true; break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Production API did not become ready: ${output}`);
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('close', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited; clearTimeout(timer);
    }
  }
}
await db.connect();
try {
  await reset();
  await migrate();
  await assertCompleteSchema();
  await insertSentinel();
  const initialLedger = await ledger();
  await migrate();
  assert.deepEqual(await ledger(), initialLedger);
  await assertSentinel();
  await assertProductionServerStarts();
  console.log('PASS: fresh production startup, complete canonical ledger, repeat no-op and production API/database startup');

  await reset();
  await Promise.all([migrate(), migrate()]);
  await assertCompleteSchema();
  console.log('PASS: simultaneous first starts serialize without duplicate baseline or forward migrations');

  await existingBaseline();
  const historicalLedger = await ledger();
  await migrate();
  await assertCompleteSchema();
  await assertSentinel();
  assert.deepEqual((await ledger()).filter((row) => baseline.includes(row.name)), historicalLedger);
  const upgradedLedger = await ledger();
  await migrate();
  assert.deepEqual(await ledger(), upgradedLedger);
  await assertSentinel();
  console.log('PASS: existing baseline upgrade preserves customer row and historical ledger');

  await existingBaseline();
  // Migration 017 creates this table unconditionally. A controlled conflicting
  // object forces an actual SQL error after migrations 011-016 execute.
  await db.query("CREATE TABLE organization_access_applications(id integer PRIMARY KEY,note text); INSERT INTO organization_access_applications VALUES(1,'preserve conflict fixture')");
  await db.query("INSERT INTO roles(name,permissions) VALUES('regulator',ARRAY['fixture.keep']::text[])");
  const beforeFailedUpgrade = { ledger: await ledger(), schema: await schemaFingerprint() };
  const failureOutput = await migrate(false);
  assert.match(failureOutput, /organization_access_applications.*already exists|already exists.*organization_access_applications/s);
  assert.deepEqual(await ledger(), beforeFailedUpgrade.ledger);
  assert.deepEqual(await schemaFingerprint(), beforeFailedUpgrade.schema);
  await assertSentinel();
  assert.deepEqual((await db.query("SELECT permissions FROM roles WHERE name='regulator'")).rows[0].permissions, ['fixture.keep']);
  assert.deepEqual((await db.query('SELECT * FROM organization_access_applications')).rows, [{ id: 1, note: 'preserve conflict fixture' }]);
  assert.equal((await db.query('SELECT is_locked FROM knex_migrations_lock')).rows[0].is_locked, 0);
  console.log('PASS: real forward SQL failure rolls back prior schema changes, data changes, ledger entries and migration locks');

  await reset();
  await db.query('CREATE TABLE customer_sentinel(id integer PRIMARY KEY, note text); INSERT INTO customer_sentinel VALUES(1,\'preserve me\')');
  await migrate(false);
  assert.deepEqual((await db.query('SELECT * FROM customer_sentinel')).rows, [{ id: 1, note: 'preserve me' }]);
  assert.equal((await db.query("SELECT to_regclass('public.knex_migrations') AS ledger")).rows[0].ledger, null);
  console.log('PASS: occupied ledgerless database rejected without modifying customer data');

  for (const [description, setup, assertion] of [
    ['view', "CREATE VIEW customer_view AS SELECT 'preserve me'::text AS note", "SELECT note FROM customer_view"],
    ['routine', "CREATE FUNCTION customer_routine() RETURNS text LANGUAGE sql AS $$ SELECT 'preserve me'::text $$", "SELECT customer_routine() AS note"],
  ]) {
    await reset();
    await db.query(setup);
    await migrate(false);
    assert.deepEqual((await db.query(assertion)).rows, [{ note: 'preserve me' }]);
    assert.equal((await db.query("SELECT to_regclass('public.knex_migrations') AS ledger")).rows[0].ledger, null);
    console.log(`PASS: ledgerless customer ${description} prevents automatic baseline initialization`);
  }

  await existingBaseline();
  await db.query("DELETE FROM knex_migrations WHERE name IN ('009_supplier_paths_and_real_sourcing.ts','010_live_traceability_wiring.ts')");
  const partialLedger = await ledger();
  await migrate(false);
  assert.deepEqual(await ledger(), partialLedger);
  await assertSentinel();
  console.log('PASS: incomplete historical ledger cannot silently mark migrations applied');

  await existingBaseline();
  await db.query("INSERT INTO knex_migrations(name,batch,migration_time) VALUES('unknown_removed_migration.ts',1,NOW())");
  const unknownLedger = await ledger();
  await migrate(false);
  assert.deepEqual(await ledger(), unknownLedger);
  await assertSentinel();
  console.log('PASS: unknown historical migration rejected without altering ledger or customer row');

  await existingBaseline();
  await db.query('UPDATE knex_migrations_lock SET is_locked=1');
  const lockedLedger = await ledger();
  await migrate(false);
  assert.deepEqual(await ledger(), lockedLedger);
  assert.equal((await db.query('SELECT is_locked FROM knex_migrations_lock')).rows[0].is_locked, 1);
  await assertSentinel();
  console.log('PASS: stale Knex lock is not automatically cleared or bypassed');

} finally { await db.end(); }
