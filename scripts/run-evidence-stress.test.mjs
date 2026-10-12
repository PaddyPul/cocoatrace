import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  genuinePdf,
  parseSnapshot,
  requireStressPorts,
  stressEnvironment,
  stressFileBytes,
  stressRssBudgetBytes,
} from './run-evidence-stress.mjs';

test('stress ports are explicit distinct non-privileged loopback targets', () => {
  const ports = requireStressPorts();
  assert.deepEqual(Object.values(ports), ['15446', '19012', '13322']);
  for (const raw of ['0', '80', '65536', '1.5', '15446;echo danger', ''])
    assert.throws(() => requireStressPorts({ BETTERTRADE_STRESS_DB_PORT: raw }), /PORT_INVALID/);
  assert.throws(
    () => requireStressPorts({ BETTERTRADE_STRESS_STORAGE_PORT: '15446' }),
    /PORT_COLLISION/,
  );
  const env = stressEnvironment(ports);
  const database = new URL(env.DATABASE_URL);
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.pathname, '/bettertrade_evidence_stress_test');
  assert.equal(env.EVIDENCE_STRESS_FIXTURES, 'true');
  assert.equal(env.APP_ENV, 'test');
  assert.equal(env.IDENTITY_EMAIL_ENABLED, 'false');
  assert.equal(env.EMAIL_DRIVER, 'development');
  assert.equal(env.EVIDENCE_MAX_FILE_BYTES, String(stressFileBytes));
  assert.equal(env.EVIDENCE_SCANNER_RETRIES, '0');
});
test('genuine maximum-size PDF keeps exact size, cross-reference offsets and EOF', () => {
  const pdf = genuinePdf();
  assert.equal(pdf.length, stressFileBytes);
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.7');
  assert.equal(pdf.subarray(-6).toString(), '%%EOF\n');
  const tail = pdf.subarray(-512).toString();
  const offset = Number(tail.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(pdf.subarray(offset, offset + 4).toString(), 'xref');
  const offsets = tail.match(/\d{10} 00000 n /g).map((row) => Number(row.slice(0, 10)));
  offsets.forEach((offset, index) =>
    assert.equal(pdf.subarray(offset, offset + 7).toString(), `${index + 1} 0 obj`),
  );
  assert.throws(() => genuinePdf(20));
});
test('IPC memory protocol rejects incomplete, unbounded and inconsistent samples and strips extras', () => {
  const sample = {
    type: 'snapshot',
    id: 1,
    baselineRssBytes: 100,
    peakRssBytes: 200,
    rssBytes: 150,
    activeTransfers: 4,
    activeTenants: 2,
    heldDownloadBuffers: 4,
  };
  assert.equal(parseSnapshot({ ...sample, token: 'secret', url: 'private' }).peakRssBytes, 200);
  assert.equal('token' in parseSnapshot({ ...sample, token: 'secret' }), false);
  assert.throws(() => parseSnapshot({ ...sample, activeTransfers: 5 }));
  assert.throws(() => parseSnapshot({ ...sample, heldDownloadBuffers: 5 }));
  assert.throws(() => parseSnapshot({ ...sample, peakRssBytes: 99 }));
  assert.throws(() => parseSnapshot({ ...sample, rssBytes: -1 }));
  assert.throws(() => parseSnapshot({ type: 'ready', actors: [] }));
  assert.equal(stressRssBudgetBytes, 512 * 1024 * 1024);
});
test('fixture guard refuses other databases without invoking fixture writes', () => {
  const source = `import {requireEvidenceStressDatabase} from './api/scripts/evidence-stress-fixtures.ts';const valid={APP_ENV:'test',EVIDENCE_STRESS_FIXTURES:'true',DATABASE_URL:'postgresql://stress_test:stress_test@127.0.0.1:15446/bettertrade_evidence_stress_test'};if(requireEvidenceStressDatabase(valid)!==valid.DATABASE_URL)process.exit(2);for(const change of [{APP_ENV:'production'},{EVIDENCE_STRESS_FIXTURES:'false'},{DATABASE_URL:'postgresql://stress_test:stress_test@remote.example:15446/bettertrade_evidence_stress_test'},{DATABASE_URL:'postgresql://stress_test:stress_test@127.0.0.1:15446/customer_test'},{DATABASE_URL:'postgresql://customer:password@127.0.0.1:15446/bettertrade_evidence_stress_test'}]){let refused=false;try{requireEvidenceStressDatabase({...valid,...change});}catch{refused=true;}if(!refused)process.exit(3);}`;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', source],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});
test('runner never overwrites source or resets customer schemas and keeps output allowlisted', () => {
  const runner = fs.readFileSync(new URL('./run-evidence-stress.mjs', import.meta.url), 'utf8');
  const fixture = fs.readFileSync(
    new URL('../api/scripts/evidence-stress-fixtures.ts', import.meta.url),
    'utf8',
  );
  const compose = fs.readFileSync(
    new URL('../docker-compose.evidence-stress.yml', import.meta.url),
    'utf8',
  );
  assert.match(runner, /\.run\.lock/);
  assert.match(runner, /'wx'/);
  assert.match(runner, /evidence-stress-test-results/);
  assert.doesNotMatch(runner, /--wait-timeout/);
  assert.doesNotMatch(runner, /\['run'[^\]]*--build/);
  assert.doesNotMatch(fixture, /DROP SCHEMA|TRUNCATE TABLE/);
  assert.match(fixture, /EVIDENCE_STRESS_DATABASE_NOT_EMPTY/);
  assert.doesNotMatch(compose, /^volumes:/m);
  assert.match(compose, /tmpfs:/);
  assert.match(compose, /127\.0\.0\.1:/);
  assert.match(
    runner,
    /stdio: \['ignore', 'ignore', 'ignore', 'ipc'\]|stdio:\['ignore','ignore','ignore','ipc'\]/,
  );
});

test('stress environment passes the real API configuration isolation rules', () => {
  const environment = stressEnvironment(requireStressPorts());
  const check = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', "require('./api/src/config/env.ts').parseConfig(process.env)"],
    { env: { ...process.env, ...environment }, encoding: 'utf8' },
  );
  assert.equal(
    check.status,
    0,
    'Synthetic stress settings must satisfy the actual API config parser',
  );
  const rejected = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', "require('./api/src/config/env.ts').parseConfig(process.env)"],
    {
      env: {
        ...process.env,
        ...environment,
        EVIDENCE_STORAGE_BUCKET: 'bettertrade-evidence-stress',
      },
      encoding: 'utf8',
    },
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /EVIDENCE_STORAGE_BUCKET must include the environment name/);
});

test('stress bootstrap gives Knex the registered TypeScript migration directory', () => {
  const environment = stressEnvironment(requireStressPorts());
  const script = `
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const fs = require('node:fs');
    const { evidenceStressDatabaseConfig } = require('./api/scripts/evidence-stress-fixtures.ts');
    const { FsMigrations } = require('knex/lib/migrations/migrate/sources/fs-migrations');
    const config = evidenceStressDatabaseConfig(process.env);
    assert.equal(config.migrations.extension, 'ts');
    assert.equal(config.migrations.directory, path.resolve('api/src/migrations'));
    const expected = fs.readdirSync(config.migrations.directory).filter(name => name.endsWith('.ts')).sort();
    new FsMigrations(config.migrations.directory, false, ['.ts']).getMigrations().then(files => {
      assert.deepEqual(files.map(file => file.file).sort(), expected);
      assert.ok(expected.includes('035_evidence_object_cleanup.ts'));
    }).catch(() => { process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
    env: { ...process.env, ...environment },
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    'Knex must enumerate the full real migration source before bootstrap',
  );
});

test('post-read download barrier retains all four buffers until explicit release', () => {
  const script = `
    const assert = require('node:assert/strict');
    const { StressDownloadBarrier } = require('./api/scripts/evidence-stress-barrier.ts');
    (async () => {
      const barrier = new StressDownloadBarrier();
      await barrier.wait();
      assert.equal(barrier.count(), 0);
      barrier.arm();
      let completed = 0;
      const bytes = Buffer.alloc(1024, 7);
      const reads = Array.from({length: 4}, async () => {
        await barrier.wait();
        completed++;
        return bytes;
      });
      await Promise.resolve();
      assert.equal(barrier.count(), 4);
      assert.equal(completed, 0);
      assert.throws(() => barrier.arm(), /ALREADY_ACTIVE/);
      barrier.release();
      const results = await Promise.all(reads);
      assert.equal(barrier.count(), 0);
      assert.equal(completed, 4);
      assert.ok(results.every(result => result === bytes));
      barrier.release();
      barrier.arm();
      barrier.release();
    })().catch(() => { process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0, 'All real read buffers must remain observable until release');
});
