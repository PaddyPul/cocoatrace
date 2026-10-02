import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const project = 'cocoatrace-recovery-tests';
const service = 'postgres-recovery-test';
const sourceDatabase = 'cocoatrace_recovery_source';
const restoredDatabase = 'cocoatrace_recovery_restored';
const archive = '/tmp/cocoatrace-recovery-rehearsal.dump';
const compose = ['compose', '-p', project, '-f', path.join(root, 'docker-compose.recovery-tests.yml')];

function port(name, fallback) {
  const value = process.env[name] || fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error(`${name} must be a valid non-privileged port`);
  }
  return value;
}

function run(args, options = {}) {
  const result = spawnSync(docker, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.error) throw new Error('Unable to run Docker. Install/start Docker Desktop and retry.', { cause: result.error });
  if (options.stdio !== 'inherit') {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return result;
}

function composeRun(args, options = {}) {
  return run([...compose, ...args], options);
}

function requireSuccess(result, message) {
  if (result.status !== 0) throw new Error(`${message} (exit ${result.status ?? 'unknown'})`);
  return result;
}

function postgresTool(tool, args, options = {}) {
  return composeRun(['exec', '-T', service, tool, ...args], options);
}

function psql(database, sql, tuplesOnly = false) {
  const args = ['-v', 'ON_ERROR_STOP=1', '-U', 'recovery_test', '-d', database];
  if (tuplesOnly) args.push('-At');
  const result = postgresTool('psql', args, { input: sql });
  requireSuccess(result, `PostgreSQL command failed in ${database}`);
  return (result.stdout || '').trim();
}

function assertDisposableTarget() {
  assert.equal(project, 'cocoatrace-recovery-tests');
  assert.equal(sourceDatabase, 'cocoatrace_recovery_source');
  assert.equal(restoredDatabase, 'cocoatrace_recovery_restored');
  assert.notEqual(sourceDatabase, restoredDatabase);
}

const fixtureSql = String.raw`
DO $$ BEGIN
  IF current_database() <> 'cocoatrace_recovery_source' THEN
    RAISE EXCEPTION 'Recovery fixture guard rejected database %', current_database();
  END IF;
END $$;

INSERT INTO organizations(id,name,type,jurisdiction,verification_status)
VALUES('10000000-0000-4000-8000-000000000001','RECOVERY REHEARSAL ONLY organization','exporter','GH','verified');
INSERT INTO users(id,organization_id,email,password_hash,name)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  'recovery-rehearsal-only@invalid.example','not-a-login-secret','RECOVERY REHEARSAL ONLY user');
INSERT INTO farms(id,farmer_organization_id,name,country,region,district,verification_status)
VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  'RECOVERY REHEARSAL ONLY farm','GH','Test region','Test district','self_declared');
INSERT INTO harvest_batches(id,farm_id,crop,harvest_date,quantity_kg,current_holder_id,organic_claim_status,source_mode)
VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
  'recovery-test-material','2026-01-02',12.345,'10000000-0000-4000-8000-000000000001','none','farm_traceable');
INSERT INTO evidence_items(id,uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,
  sha256_hash,storage_key,storage_provider,detected_mime_type,validation_status,malware_scan_status,
  malware_scanner_engine,malware_scanned_at,review_status,linked_entity_type,linked_entity_id,claim_description)
VALUES('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','other','RECOVERY_REHEARSAL_ONLY_metadata.pdf',321,
  'application/pdf','sha256:recovery-rehearsal-only','evidence/recovery-test/metadata-only','s3','application/pdf',
  'validated','clean','recovery-test-scanner',NOW(),'pending','batch','40000000-0000-4000-8000-000000000001',
  'RECOVERY REHEARSAL ONLY evidence metadata; no object bytes exist');
INSERT INTO audit_events(id,actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
VALUES('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','recovery.rehearsal.fixture','harvest_batch',
  '40000000-0000-4000-8000-000000000001','sha256:recovery-rehearsal-only',
  '{"fixture":"RECOVERY_REHEARSAL_ONLY","containsObjectBytes":false}'::jsonb);
`;

const verifyFixtureSql = String.raw`
DO $$
DECLARE linked_rows integer; evidence_rows integer; audit_rows integer;
BEGIN
  SELECT COUNT(*) INTO linked_rows
    FROM organizations organization
    JOIN users member ON member.organization_id=organization.id
    JOIN farms farm ON farm.farmer_organization_id=organization.id
    JOIN harvest_batches batch ON batch.farm_id=farm.id AND batch.current_holder_id=organization.id
    WHERE organization.id='10000000-0000-4000-8000-000000000001'
      AND member.id='20000000-0000-4000-8000-000000000001'
      AND farm.id='30000000-0000-4000-8000-000000000001'
      AND batch.id='40000000-0000-4000-8000-000000000001'
      AND batch.quantity_kg=12.345;
  SELECT COUNT(*) INTO evidence_rows FROM evidence_items
    WHERE id='50000000-0000-4000-8000-000000000001'
      AND linked_entity_type='batch' AND linked_entity_id='40000000-0000-4000-8000-000000000001'
      AND storage_provider='s3' AND storage_key='evidence/recovery-test/metadata-only'
      AND validation_status='validated' AND malware_scan_status='clean'
      AND review_status='pending' AND file_size_bytes=321;
  SELECT COUNT(*) INTO audit_rows FROM audit_events
    WHERE id='60000000-0000-4000-8000-000000000001'
      AND actor_user_id='20000000-0000-4000-8000-000000000001'
      AND actor_organization_id='10000000-0000-4000-8000-000000000001'
      AND entity_id='40000000-0000-4000-8000-000000000001'
      AND metadata->>'fixture'='RECOVERY_REHEARSAL_ONLY'
      AND metadata->>'containsObjectBytes'='false';
  IF linked_rows<>1 OR evidence_rows<>1 OR audit_rows<>1 THEN
    RAISE EXCEPTION 'Recovery fixture verification failed: linked %, evidence %, audit %',linked_rows,evidence_rows,audit_rows;
  END IF;
END $$;
`;

function migrationNames() {
  return fs.readdirSync(path.join(root, 'api/src/migrations'))
    .filter((name) => name.endsWith('.ts')).sort();
}

function databaseFingerprint(database) {
  return psql(database, String.raw`
    WITH parts AS (
      SELECT 'relation:'||c.relname||':'||c.relkind AS value
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
      UNION ALL
      SELECT 'column:'||table_name||':'||ordinal_position||':'||column_name||':'||data_type||':'||is_nullable||':'||COALESCE(column_default,'')
      FROM information_schema.columns WHERE table_schema='public'
      UNION ALL
      SELECT 'constraint:'||table_name||':'||constraint_name||':'||constraint_type
      FROM information_schema.table_constraints WHERE table_schema='public'
    ) SELECT md5(string_agg(value,E'\n' ORDER BY value)) FROM parts;
  `, true);
}

function assertMigrationLedger(database, expected) {
  const output = psql(database, "SELECT name FROM knex_migrations ORDER BY name;", true);
  assert.deepEqual(output ? output.split(/\r?\n/) : [], expected, `${database} migration history differs from the forward migration set`);
}

let started = false;
try {
  assertDisposableTarget();
  const dbPort = port('COCOATRACE_RECOVERY_DB_PORT', '15436');
  started = true;
  requireSuccess(composeRun(['down', '--volumes', '--remove-orphans'], { stdio: 'inherit' }), 'Could not reset the isolated recovery project');
  requireSuccess(composeRun(['up', '-d', '--wait', service], {
    stdio: 'inherit', env: { ...process.env, COCOATRACE_RECOVERY_DB_PORT: dbPort },
  }), 'Disposable recovery PostgreSQL failed startup');
  requireSuccess(composeRun(['build', 'recovery-migrate'], { stdio: 'inherit' }), 'Recovery migration image build failed');
  requireSuccess(composeRun(['run', '--rm', 'recovery-migrate'], { stdio: 'inherit' }), 'Forward migrations failed in the source rehearsal database');

  assert.equal(psql(sourceDatabase, 'SELECT current_database();', true), sourceDatabase);
  const expectedMigrations = migrationNames();
  assertMigrationLedger(sourceDatabase, expectedMigrations);
  psql(sourceDatabase, fixtureSql);
  psql(sourceDatabase, verifyFixtureSql);
  const sourceFingerprint = databaseFingerprint(sourceDatabase);

  requireSuccess(postgresTool('pg_dump', [
    '--format=custom', '--no-owner', '--no-privileges', '--file', archive,
    '--username', 'recovery_test', '--dbname', sourceDatabase,
  ], { stdio: 'inherit' }), 'Custom-format PostgreSQL backup failed');
  requireSuccess(postgresTool('pg_restore', ['--list', archive], { stdio: 'inherit' }), 'Backup archive cannot be read by pg_restore');

  // Both names are constants guarded above. This PostgreSQL instance belongs to
  // the dedicated Compose project and uses tmpfs; no external database is used.
  requireSuccess(postgresTool('dropdb', ['--if-exists', '--username', 'recovery_test', restoredDatabase], { stdio: 'inherit' }), 'Could not reset the restored rehearsal database');
  requireSuccess(postgresTool('createdb', ['--username', 'recovery_test', restoredDatabase], { stdio: 'inherit' }), 'Could not create the fresh restore target');
  requireSuccess(postgresTool('pg_restore', [
    '--exit-on-error', '--no-owner', '--no-privileges', '--username', 'recovery_test',
    '--dbname', restoredDatabase, archive,
  ], { stdio: 'inherit' }), 'Restore into the fresh rehearsal database failed');

  assert.equal(psql(restoredDatabase, 'SELECT current_database();', true), restoredDatabase);
  assertMigrationLedger(restoredDatabase, expectedMigrations);
  psql(restoredDatabase, verifyFixtureSql);
  assert.equal(databaseFingerprint(restoredDatabase), sourceFingerprint, 'Restored public schema fingerprint differs from the migrated source');
  console.log('PASS: forward-migrated schema, migration history, linked fixtures, evidence metadata and audit history restored into a separate fresh database');
  console.log('NOTE: this rehearsal validates PostgreSQL only; private evidence object bytes and provider-managed backup automation are outside its scope.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      const cleanup = composeRun(['down', '--volumes', '--remove-orphans'], { stdio: 'inherit' });
      if (cleanup.status !== 0) process.exitCode = process.exitCode || cleanup.status || 1;
    } catch (error) {
      console.error(`Recovery rehearsal cleanup failed: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
}
