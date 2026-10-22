import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFindings, scannerArguments, scannerImage } from './secret-scan.mjs';
const finding = {
  Fingerprint: 'commit:file:rule:1',
  RuleID: 'rule',
  File: 'file',
  StartLine: 1,
  Secret: 'must-never-appear',
  Match: 'context-must-never-appear',
  Author: 'private-author',
};
const exception = {
  fingerprint: finding.Fingerprint,
  reason: 'reviewed synthetic fixture',
  expires: '2027-01-20',
};
const now = new Date('2026-10-22T00:00:00Z');
test('unreviewed findings fail and the persisted projection contains no secret/context/identity', () => {
  const report = reviewFindings([finding], [], now);
  assert.equal(report.status, 'failed');
  assert.doesNotMatch(
    JSON.stringify(report),
    /must-never-appear|private-author|Secret|Match|Author/,
  );
});
test('only an exact current exception is accepted; a changed occurrence fails', () => {
  assert.equal(reviewFindings([finding], [exception], now).status, 'passed');
  assert.equal(
    reviewFindings([{ ...finding, Fingerprint: 'another:file:rule:1' }], [exception], now).status,
    'failed',
  );
});
test('expired, duplicate, missing-review and malformed exceptions fail even without findings', () => {
  for (const entries of [
    [{ ...exception, expires: '2026-10-21' }],
    [exception, exception],
    [{ ...exception, reason: '' }],
    [{ ...exception, expires: 'tomorrow' }],
  ])
    assert.throws(() => reviewFindings([], entries, now));
  assert.throws(() => reviewFindings([{}], [], now));
});
test('Docker scans read-only without network and suppresses inline/path ignores and raw values', () => {
  const args = scannerArguments('/repo with spaces', '/tmp/report dir');
  assert.ok(scannerImage.includes('@sha256:'));
  assert.ok(args.includes('--network=none') && args.includes('--read-only'));
  assert.ok(args.includes('type=bind,source=/repo with spaces,target=/repo,readonly'));
  assert.ok(args.includes('--redact=100'));
  assert.ok(args.includes('--ignore-gitleaks-allow'));
  assert.equal(args[args.indexOf('--gitleaks-ignore-path') + 1], '/report/no-ignores');
  assert.ok(!args.includes('--baseline-path'));
});
