import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateImageReport, runImageChecks, scannerImage } from './check-container-security.mjs';
const report = (items = []) => ({
  SchemaVersion: 2,
  Metadata: { OS: { Family: 'alpine' } },
  Results: [
    { Class: 'os-pkgs', Vulnerabilities: items },
    { Class: 'lang-pkgs', Type: 'node-pkg' },
  ],
});
test('high, critical and unknown findings block even without an available fix', () => {
  for (const Severity of ['HIGH', 'CRITICAL', 'UNKNOWN', undefined]) {
    assert.equal(
      evaluateImageReport(report([{ Severity, VulnerabilityID: 'CVE-probe' }])).status,
      'failed',
    );
  }
});
test('low and medium findings remain visible and a clean report passes', () => {
  assert.equal(evaluateImageReport(report()).status, 'passed');
  const result = evaluateImageReport(report([{ Severity: 'MEDIUM' }, { Severity: 'LOW' }]));
  assert.equal(result.status, 'passed');
  assert.equal(result.counts.MEDIUM, 1);
  assert.equal(result.counts.LOW, 1);
});
test('missing and malformed scanner reports fail closed', () => {
  for (const value of [
    {},
    { SchemaVersion: 2, Metadata: {}, Results: [{}], error: true },
    { SchemaVersion: 2, Metadata: {}, Results: 'bad' },
  ]) {
    if (value.error) value.Results[0].Vulnerabilities = 'bad';
    assert.throws(() => evaluateImageReport(value));
  }
});
function exercise(failAt, high = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'image-policy-test-'));
  const calls = [];
  try {
    const execute = (args) => {
      calls.push(args);
      if (args[0] === failAt) throw new Error('simulated failure');
      if (args.includes(scannerImage)) {
        const name = args[args.indexOf('--input') + 1].includes('api.tar') ? 'api' : 'web';
        fs.writeFileSync(
          path.join(directory, `${name}.json`),
          JSON.stringify(report(high ? [{ Severity: 'HIGH' }] : [])),
        );
      }
    };
    return {
      result: runImageChecks(execute, 'C:\\Project with spaces', directory, 'C:\\Private temp'),
      calls,
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test('both runtime images are checked and scanned without Docker socket access', () => {
  const { result, calls } = exercise();
  assert.equal(result.status, 'passed');
  assert.equal(calls.filter((args) => args.includes(scannerImage)).length, 2);
  assert.ok(calls.filter((args) => args[0] === 'build').every((args) => args.includes('--pull')));
  assert.ok(
    calls.every(
      (args) =>
        !args.some((value) => value.includes('docker.sock') || value === '--ignore-unfixed'),
    ),
  );
  assert.ok(calls.some((args) => args.includes('api/scripts/check-runtime-image.mjs')));
  assert.ok(calls.some((args) => args.includes('api:127.0.0.1')));
  assert.ok(
    calls.some((args) =>
      args.some((value) => value.includes('! apk info -e tiff') && value.includes('nginx -t')),
    ),
  );
  assert.ok(calls.some((args) => args.includes('C:\\Private temp:/scan:ro')));
});
test('a completed scan with findings cannot report a passing release', () => {
  const { result } = exercise(undefined, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.images.length, 2);
});
test('build and scanner launch failures stop without bypassing the failed step', () => {
  assert.throws(() => exercise('build'));
  assert.throws(() => exercise('run'));
});

test('absent OS coverage and end-of-support images fail closed', () => {
  assert.throws(() =>
    evaluateImageReport({ SchemaVersion: 2, Metadata: { OS: { Family: 'alpine' } }, Results: [] }),
  );
  const old = report();
  old.Metadata.OS.Eosl = true;
  assert.throws(() => evaluateImageReport(old));
});

test('API scans require installed Node package coverage', () => {
  const missing = report();
  missing.Results.pop();
  assert.throws(() => evaluateImageReport(missing, true));
  assert.equal(evaluateImageReport(report(), true).status, 'passed');
  assert.equal(evaluateImageReport(missing, false).status, 'passed');
});

test('runtime removes package-manager trees and deployed runners invoke installed Node directly', () => {
  const root = new URL('../', import.meta.url);
  const dockerfile = fs.readFileSync(new URL('api/Dockerfile', root), 'utf8');
  const install = dockerfile.indexOf('RUN npm ci --workspace=api --omit=dev');
  for (const target of [
    '/usr/local/lib/node_modules/npm',
    '/usr/local/lib/node_modules/corepack',
    '/opt/yarn*',
    '/usr/local/bin/npm',
    '/usr/local/bin/npx',
  ]) {
    assert.ok(
      dockerfile.indexOf(target, install) > install,
      `Remove ${target} after production install`,
    );
  }
  for (const file of [
    'docker-compose.demo-preview.yml',
    'docker-compose.recovery-tests.yml',
    'scripts/run-browser-tests.mjs',
  ]) {
    const content = fs.readFileSync(new URL(file, root), 'utf8');
    assert.ok(!/\bnpx\b/.test(content), `${file} must not require npx`);
    assert.ok(
      content.includes('--import') && content.includes('tsx'),
      `${file} must use installed tsx`,
    );
  }
  const runtimeCheck = fs.readFileSync(
    new URL('api/scripts/check-runtime-image.mjs', root),
    'utf8',
  );
  assert.ok(runtimeCheck.includes('/usr/local/lib/node_modules/npm'));
  assert.ok(runtimeCheck.includes('/usr/local/bin/npx'));
});

test('blocked findings retain image package paths for diagnosis', () => {
  const input = report([
    { Severity: 'HIGH', PkgPath: 'usr/local/lib/node_modules/npm/node_modules/tar/package.json' },
  ]);
  input.Results[0].Target = 'global npm';
  const failure = evaluateImageReport(input).failures[0];
  assert.equal(failure.target, 'global npm');
  assert.equal(failure.packagePath, 'usr/local/lib/node_modules/npm/node_modules/tar/package.json');
});
