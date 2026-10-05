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
