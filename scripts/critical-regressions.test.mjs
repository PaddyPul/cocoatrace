import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegisters, validatePullRequest } from './critical-regressions.mjs';
const coverage = {
  version: 1,
  domains: Array.from({ length: 7 }, (_, i) => ({
    id: `domain${i}`,
    ownerRole: 'Maintainer',
    gap: 'Hosted evidence pending',
    suite: 'suite',
    scenarios: ['failure rolls back'],
  })),
};
const empty = { version: 1, defects: [] };
const defect = {
  id: 'P0-LOSS',
  failure: 'Data loss',
  suite: 'suite',
  testTitle: 'failure rolls back',
};
test('coverage validates evidence links without claiming execution', () => {
  assert.deepEqual(
    validateRegisters(coverage, empty, () => "it('failure rolls back'); expect(value)"),
    { domains: 7, scenarios: 7, defects: 0 },
  );
  assert.throws(
    () => validateRegisters(coverage, empty, () => 'renamed test'),
    /Missing registered scenario/,
  );
});
test('missing assertions and duplicate domain entries fail', () => {
  assert.throws(
    () => validateRegisters(coverage, empty, () => 'failure rolls back'),
    /no assertions/,
  );
  assert.throws(
    () =>
      validateRegisters(
        { ...coverage, domains: [...coverage.domains, coverage.domains[0]] },
        empty,
        () => 'failure rolls back expect(value)',
      ),
    /unique identity/,
  );
});
test('P0 register rejects missing regressions and duplicate defects', () => {
  assert.throws(
    () =>
      validateRegisters(coverage, { version: 1, defects: [defect] }, () =>
        'failure rolls back expect(value)'.replace('failure rolls back', 'removed'),
      ),
    /Missing registered scenario/,
  );
  assert.throws(
    () =>
      validateRegisters(
        coverage,
        { version: 1, defects: [defect, defect] },
        () => 'failure rolls back expect(value)',
      ),
    /duplicate P0/,
  );
});
test('confirmed P0 PR requires a current registered ID, label cannot bypass it', () => {
  assert.throws(
    () =>
      validatePullRequest(
        { pull_request: { labels: [{ name: 'severity:P0' }], body: 'ordinary change' } },
        empty,
      ),
    /registered regression/,
  );
  assert.throws(
    () => validatePullRequest({ pull_request: { body: 'Defect severity: P0' } }, empty),
    /registered regression/,
  );
  validatePullRequest(
    { pull_request: { body: 'Defect severity: P0\nP0-LOSS' } },
    { defects: [defect] },
  );
  validatePullRequest({ pull_request: { body: 'Defect severity: none' } }, empty);
});
