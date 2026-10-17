import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLoadEvidence, invalidateLoadEvidence } from './pilot-load.mjs';
import { buildPilotLoadReport, LOAD_NAMES } from '../api/src/testing/pilotLoadReport.ts';
const sha = 'a'.repeat(40),
  targets = {
    sampleCount: 100,
    concurrency: 4,
    p95Ms: 2000,
    p99Ms: 5000,
    classification: 'provisional-engineering-target',
  };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-load-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'pilot-load-test-results'));
  fs.mkdirSync(path.join(root, 'docs/performance'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs/performance/capacity-policy.json'),
    JSON.stringify({ loadTargets: targets }),
  );
  const file = path.join(root, 'pilot-load-test-results/summary.json');
  const report = buildPilotLoadReport(
    {
      commit: sha,
      startedAt: '2026-10-17T00:00:00Z',
      completedAt: '2026-10-17T00:01:00Z',
      hardware: {
        platform: 'linux',
        architecture: 'x64',
        node: 'v24.21.0',
        cpuCount: 4,
        hostMemoryBytes: 16000000000,
      },
      volumes: {
        listings: 1005,
        traceLots: 200,
        traceEdges: 199,
        measuredOfferWrites: 150,
        provenanceEvidenceRows: 100,
      },
      workloads: LOAD_NAMES.map((name) => ({
        name,
        concurrency: 4,
        invariantsPassed: true,
        samples: Array.from({ length: 100 }, () => ({
          durationMs: 10,
          status: 200,
          expectedStatus: 200,
        })),
      })),
    },
    targets,
  );
  fs.writeFileSync(file, JSON.stringify(report));
  return { root, file, report };
}
test('accepts complete current-commit evidence and rejects stale output', (t) => {
  const { root } = fixture(t);
  assert.equal(checkLoadEvidence(root, sha).workloads, 6);
  assert.throws(() => checkLoadEvidence(root, 'b'.repeat(40)));
});
test('invalidates only the known artifact before a new run', (t) => {
  const { root, file } = fixture(t);
  const local = path.join(root, 'preserve.txt');
  fs.writeFileSync(local, 'keep');
  invalidateLoadEvidence(root);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(local, 'utf8'), 'keep');
  assert.throws(() => checkLoadEvidence(root, sha));
});
test('rejects malformed, oversized and missing-workload results', (t) => {
  const { root, file, report } = fixture(t);
  for (const body of [
    '{',
    ' '.repeat(65537),
    JSON.stringify({ ...report, workloads: report.workloads.slice(1) }),
  ]) {
    fs.writeFileSync(file, body);
    assert.throws(() => checkLoadEvidence(root, sha));
  }
});
