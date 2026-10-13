import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBacklog, progress, summarize } from './backlog-progress.mjs';

test('counts named rows only, recognizes header progress and gives no partial credit', () => {
  const rows = parseBacklog(
    '- [x] **ABC-001 · P1:** Done\n- [ ] **ABC-002 · IN PROGRESS:** Part\n- [-] **ABC-003 · P1:** Part\n- [ ] **ABC-004 · P1:** Open\n- [x] unnamed checkbox\n',
  );
  assert.deepEqual(summarize(rows), {
    total: 4,
    complete: 1,
    partial: 2,
    blocked: 0,
    open: 1,
    completedPercent: 25,
  });
  assert.equal(summarize([]).completedPercent, 0);
});

test('current gate register has valid unique IDs, evidence and backlog references', () => {
  const result = progress(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  assert.ok(result.roadmap.total > 300);
  assert.equal(
    result.providerLaunchIncludingCore.total,
    result.corePilot.total + result.providerAdditionalGates.total,
  );
});

test('reconciled completions retain criterion evidence and tracked follow-ups', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rows = ['docs/DELIVERY_BACKLOG.md', 'docs/runbooks/FREE_STAGING_PLAN.md'].flatMap((file) =>
    parseBacklog(fs.readFileSync(path.join(root, file), 'utf8')),
  );
  const current = new Map(rows.map((row) => [row.id, row.status]));
  const register = JSON.parse(fs.readFileSync(path.join(root, 'docs/pilot-gates.json'), 'utf8'));
  const reconciliation = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/backlog-reconciliation.json'), 'utf8'),
  );
  assert.equal(reconciliation.version, 1);
  assert.match(reconciliation.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(reconciliation.acceptance);
  const seen = new Set();
  const evidence = (files) => {
    assert.ok(Array.isArray(files) && files.length > 0);
    for (const file of files) {
      assert.equal(typeof file, 'string');
      const resolved = path.resolve(root, file);
      assert.ok(resolved.startsWith(root + path.sep), `Evidence leaves repository: ${file}`);
      assert.ok(fs.statSync(resolved).isFile(), `Missing evidence: ${file}`);
    }
  };
  for (const change of reconciliation.changes) {
    assert.ok(!seen.has(change.id), `Duplicate reconciliation: ${change.id}`);
    seen.add(change.id);
    assert.ok(['open', 'partial', 'complete'].includes(change.from));
    assert.ok(['partial', 'complete'].includes(change.to));
    assert.ok(change.reason);
    const status = current.get(change.id);
    assert.ok(
      change.to === 'complete' ? status === 'complete' : ['partial', 'complete'].includes(status),
      `Tracker lost reconciled implementation: ${change.id}`,
    );
    evidence(change.evidence);
    for (const id of change.remaining) assert.ok(current.has(id), `Untracked follow-up: ${id}`);
  }
  for (const change of reconciliation.gateChanges) {
    assert.equal(register.gates.find((gate) => gate.id === change.id)?.status, change.to);
    assert.ok(change.reason);
    evidence(change.evidence);
  }
  for (const added of reconciliation.added) {
    assert.ok(current.has(added.id));
    assert.ok(added.reason);
  }
});
