import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRisks, validateRiskRegister } from './risk-register.mjs';
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
