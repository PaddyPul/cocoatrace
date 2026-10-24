import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('object recovery canaries run as part of the mandatory existing release rehearsal', () => {
  const runner = fs.readFileSync('scripts/run-recovery-tests.mjs', 'utf8');
  assert.ok(runner.indexOf("objectPhase('prepare')") < runner.indexOf("'pg_dump'"));
  assert.ok(runner.indexOf("objectPhase('restore')") > runner.indexOf("'--exit-on-error'"));
  assert.ok(runner.includes("objectPhase('verify', restoredEvidence)"));
  const compose = fs.readFileSync('docker-compose.recovery-tests.yml', 'utf8');
  assert.match(compose, /motoserver\/moto:5\.2\.3/);
  assert.ok(
    !compose
      .slice(compose.indexOf('  moto-recovery-test:'), compose.indexOf('  recovery-migrate:'))
      .includes('ports:'),
  );
});

for (const invalidDirectory of [false, true])
  test(
    invalidDirectory
      ? 'invalid private recovery directory stops before archiving and tears down the disposable project'
      : 'failed object archive stops backup and always tears down only the disposable project',
    { skip: process.platform === 'win32' },
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-failure-'));
      try {
        const log = path.join(dir, 'calls.jsonl');
        fs.writeFileSync(
          path.join(dir, 'docker'),
          `#!/usr/bin/env node
const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.RECOVERY_CALLS,JSON.stringify(a)+'\\n');
if(a.includes('psql')) {const input=fs.readFileSync(0,'utf8');if(input.includes('current_database()'))console.log('cocoatrace_recovery_source');if(input.includes('SELECT name FROM knex_migrations'))console.log(fs.readdirSync('api/src/migrations').filter(x=>x.endsWith('.ts')).sort().join('\\n'));}
if(a.includes('mktemp'))console.log(process.env.RECOVERY_INVALID_DIRECTORY ? '/tmp/unsafe-path' : '/tmp/tmp.RecoveryTest');
if(a.includes('prepare'))process.exit(7);
`,
        );
        fs.chmodSync(path.join(dir, 'docker'), 0o755);
        const result = spawnSync(process.execPath, ['scripts/run-recovery-tests.mjs'], {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: dir + path.delimiter + process.env.PATH,
            RECOVERY_CALLS: log,
            RECOVERY_INVALID_DIRECTORY: invalidDirectory ? '1' : '',
          },
        });
        assert.equal(result.status, 1, result.stdout);
        const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
        const preparation = calls.find((args) => args.includes('prepare'));
        if (invalidDirectory) assert.equal(preparation, undefined);
        else {
          assert.ok(preparation);
          assert.ok(preparation.includes('RECOVERY_WORKSPACE=/tmp/tmp.RecoveryTest'));
        }
        assert.equal(calls.filter((args) => args.includes('mktemp')).length, 2);
        assert.ok(calls.every((args) => args.includes('cocoatrace-recovery-tests')));
        assert.ok(!calls.some((args) => args.includes('pg_dump')));
        assert.ok(calls.at(-1).includes('down'));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
