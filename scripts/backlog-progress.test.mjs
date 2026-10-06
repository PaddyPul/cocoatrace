import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
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
