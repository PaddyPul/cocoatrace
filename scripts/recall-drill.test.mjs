import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDrillEvidence, invalidateDrillEvidence } from './recall-drill.mjs';
import { buildDrillReport, DRILL_SCENARIOS } from '../api/src/testing/recallDrill.ts';
const commit = 'a'.repeat(40);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-drill-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'recall-drill-test-results');
  fs.mkdirSync(directory);
  const file = path.join(directory, 'summary.json');
  const rows = DRILL_SCENARIOS.map((name) => ({
    name,
    status: 'passed',
    elapsedMs: 1,
    graphComplete: true,
    expectedRecipients: 2,
    identifiedRecipients: 2,
    missingRecipients: 0,
    unexpectedRecipients: 0,
    unresolvedRecipients: 1,
    unresolvedContactRecipients: 0,
    expectedQuantityGrams: 10000,
    accountedQuantityGrams: 10000,
    retainedQuantityGrams: 6000,
  }));
  const report = buildDrillReport(
    commit,
    new Date('2026-10-17T00:00:00Z'),
    new Date('2026-10-17T00:00:01Z'),
    rows,
  );
  fs.writeFileSync(file, JSON.stringify(report));
  return { root, file, report };
}
test('accepts only complete current-commit evidence and emits no participant details', (t) => {
  const { root } = fixture(t);
  assert.deepEqual(checkDrillEvidence(root, commit), {
    status: 'passed',
    commit,
    scenarios: 3,
    scope: 'synthetic-disposable-native',
  });
  assert.throws(() => checkDrillEvidence(root, 'b'.repeat(40)));
});
test('invalidation removes only the known report and blocks reuse of a prior pass', (t) => {
  const { root, file } = fixture(t);
  const other = path.join(root, 'preserve.txt');
  fs.writeFileSync(other, 'local');
  invalidateDrillEvidence(root);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(other, 'utf8'), 'local');
  assert.throws(() => checkDrillEvidence(root, commit));
  invalidateDrillEvidence(root);
});
test('refuses malformed, oversized and incomplete artifacts', (t) => {
  const { root, file, report } = fixture(t);
  for (const contents of [
    '{',
    ' '.repeat(65537),
    JSON.stringify({ ...report, scenarios: report.scenarios.slice(1) }),
  ]) {
    fs.writeFileSync(file, contents);
    assert.throws(() => checkDrillEvidence(root, commit));
  }
});
