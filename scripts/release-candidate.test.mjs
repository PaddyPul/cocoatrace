import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyRelease } from './run-release-checks.mjs';

function repository(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-candidate-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init', '-b', 'candidate');
    git('config', 'user.email', 'release-test@invalid.example');
    git('config', 'user.name', 'Release fixture');
    fs.writeFileSync(path.join(root, '.gitignore'), 'release-test-results/\n');
    fs.writeFileSync(path.join(root, 'record'), 'accepted\n');
    git('add', '.');
    git('commit', '-m', 'candidate');
    run(root, git);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const checks = [['fixture', ['fixture']]];

test('passing release records the candidate captured before verification', () =>
  repository((root, git) => {
    const candidate = git('rev-parse', 'HEAD');
    const report = verifyRelease(root, () => 0, checks);
    assert.equal(report.status, 'passed');
    assert.equal(report.commit, candidate);
    assert.equal(report.branch, 'candidate');
    assert.ok(report.startedAt <= report.completedAt);
  }));
for (const mutation of ['commit', 'branch', 'tracked', 'untracked']) {
  test(`release fails when ${mutation} state changes during checks`, () =>
    repository((root, git) => {
      const candidate = git('rev-parse', 'HEAD');
      const report = verifyRelease(
        root,
        () => {
          if (mutation === 'commit') git('commit', '--allow-empty', '-m', 'changed');
          if (mutation === 'branch') git('switch', '-c', 'changed');
          if (mutation === 'tracked') fs.appendFileSync(path.join(root, 'record'), 'changed');
          if (mutation === 'untracked') fs.writeFileSync(path.join(root, 'uncommitted'), 'changed');
          return 0;
        },
        checks,
      );
      assert.equal(report.status, 'failed');
      assert.equal(report.commit, candidate);
      assert.ok(report.candidateError);
    }));
}
test('dirty preflight overwrites stale passing evidence and executes no checks', () =>
  repository((root) => {
    fs.mkdirSync(path.join(root, 'release-test-results'));
    fs.writeFileSync(path.join(root, 'release-test-results/summary.json'), '{"status":"passed"}');
    fs.writeFileSync(path.join(root, 'pending'), 'uncommitted');
    let invoked = false;
    const report = verifyRelease(
      root,
      () => {
        invoked = true;
        return 0;
      },
      checks,
    );
    assert.equal(invoked, false);
    assert.equal(report.status, 'failed');
    assert.equal(report.commit, null);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, 'release-test-results/summary.json'))),
      report,
    );
  }));
test('failed runtime retains the original candidate and failed status', () =>
  repository((root, git) => {
    const candidate = git('rev-parse', 'HEAD');
    const report = verifyRelease(root, () => 1, checks);
    assert.equal(report.status, 'failed');
    assert.equal(report.commit, candidate);
  }));
