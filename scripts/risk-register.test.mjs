import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRisks, renderRisks, validateRiskRegister } from './risk-register.mjs';
const sample = () => ({
  reviewedAt: '2026-10-15',
  nextReview: '2026-10-22',
  owner: 'Owner',
  risks: [
    {
      id: 'RSK-001',
      title: 'Boundary',
      likelihood: 'medium',
      impact: 'critical',
      status: 'open',
      mitigation: 'Keep blocked',
      backlog: ['SEC-006'],
      evidence: 'policy.md',
    },
  ],
});
test('rejects ownerless, duplicate, invalid assessment and untracked risks', () => {
  for (const mutate of [
    (data) => (data.owner = ''),
    (data) => (data.nextReview = '2026-10-01'),
    (data) => data.risks.push(data.risks[0]),
    (data) => (data.risks[0].likelihood = 'certain'),
    (data) => (data.risks[0].backlog = ['UNKNOWN']),
  ]) {
    const data = sample();
    mutate(data);
    assert.throws(() => validateRiskRegister(data, new Set(['SEC-006']), () => true));
  }
  assert.throws(() => validateRiskRegister(sample(), new Set(['SEC-006']), () => false));
});
test('current visible register matches source and due review does not imply risk closure', () => {
  const report = checkRisks(undefined, false, '2099-01-01');
  assert.equal(report.status, 'passed');
  assert.equal(report.reviewDue, true);
  assert.ok(report.risks > 0);
});

test('Windows CRLF checkout passes while changed risk content still fails', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-risk-eol-'));
  try {
    fs.mkdirSync(path.join(base, 'docs/runbooks'), { recursive: true });
    fs.writeFileSync(
      path.join(base, 'docs/DELIVERY_BACKLOG.md'),
      '- [ ] **SEC-006 · P1:** Boundary\r\n',
    );
    fs.writeFileSync(path.join(base, 'docs/runbooks/FREE_STAGING_PLAN.md'), '');
    fs.writeFileSync(path.join(base, 'policy.md'), 'Synthetic risk evidence');
    const data = sample();
    fs.writeFileSync(path.join(base, 'docs/risk-register.json'), JSON.stringify(data));
    const target = path.join(base, 'docs/RISK_REGISTER.md');
    const rendered = renderRisks(data);
    fs.writeFileSync(target, rendered.replaceAll('\n', '\r\n'));
    assert.equal(checkRisks(base, false, '2026-10-15').status, 'passed');
    fs.writeFileSync(
      target,
      rendered.replace('Keep blocked', 'Pretend resolved').replaceAll('\n', '\r\n'),
    );
    assert.throws(() => checkRisks(base), /view is stale/);
    fs.writeFileSync(target, rendered.replace('Keep blocked', 'Keep  blocked'));
    assert.throws(() => checkRisks(base), /view is stale/);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
