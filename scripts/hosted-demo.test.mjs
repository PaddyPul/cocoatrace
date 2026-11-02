import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const common = path.join(root, 'deploy/oracle-demo/common.sh');
const linux = process.platform === 'linux';
const shell = (source, env = {}) =>
  spawnSync('bash', ['-c', source, 'probe', common], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

test('Git inspection failure cannot be mistaken for a clean checkout', { skip: !linux }, () => {
  const result = shell(
    'set -euo pipefail; source "$1"; git() { return 37; }; bt_git=(git); bt_clean_checkout; echo MUTATION_REACHED',
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Git status failed/);
  assert.doesNotMatch(result.stdout, /MUTATION_REACHED/);
});

test(
  'Git inspection disables optional index writes and still refuses dirty worktrees',
  { skip: !linux },
  () => {
    const result = shell(
      'set -euo pipefail; source "$1"; [[ "$GIT_OPTIONAL_LOCKS" == 0 ]]; git() { echo " M file"; }; bt_git=(git); bt_clean_checkout; echo MUTATION_REACHED',
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Pending repository changes/);
    assert.doesNotMatch(result.stdout, /MUTATION_REACHED/);
  },
);

test(
  'CI admission requires the exact main push SHA and a successful complete workflow',
  { skip: !linux },
  () => {
    const sha = 'a'.repeat(40);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-ci-'));
    try {
      fs.writeFileSync(
        path.join(directory, 'curl'),
        '#!/usr/bin/env node\nprocess.stdout.write(process.env.BT_TEST_RUNS);\n',
      );
      fs.chmodSync(path.join(directory, 'curl'), 0o755);
      const base = {
        head_sha: sha,
        head_branch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        head_repository: { full_name: 'PaddyPul/cocoatrace' },
      };
      for (const [changes, expected] of [
        [{}, 0],
        [{ head_sha: 'b'.repeat(40) }, 1],
        [{ event: 'pull_request' }, 1],
        [{ conclusion: 'failure' }, 1],
        [{ status: 'in_progress' }, 1],
      ]) {
        const result = shell('source "$1"; bt_ci_passed "$BT_TEST_SHA"', {
          PATH: directory + path.delimiter + process.env.PATH,
          BT_TEST_SHA: sha,
          BT_TEST_RUNS: JSON.stringify({ workflow_runs: [{ ...base, ...changes }] }),
        });
        assert.equal(result.status, expected, result.stderr);
      }
      const missing = shell('source "$1"; bt_ci_passed "$BT_TEST_SHA"', {
        PATH: directory + path.delimiter + process.env.PATH,
        BT_TEST_SHA: sha,
        BT_TEST_RUNS: JSON.stringify({ workflow_runs: [] }),
      });
      assert.equal(missing.status, 1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('a clean real checkout is inspected without refreshing its index', { skip: !linux }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-git-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git('init', '--quiet');
    fs.writeFileSync(path.join(directory, 'record.txt'), 'unchanged bytes\n');
    git('add', 'record.txt');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    );
    const index = fs.readFileSync(path.join(directory, '.git/index'));
    const future = new Date(Date.now() + 10000);
    fs.utimesSync(path.join(directory, 'record.txt'), future, future);
    const result = spawnSync(
      'bash',
      [
        '-c',
        'set -euo pipefail; source "$1"; bt_root="$2"; bt_prepare_git; bt_clean_checkout',
        'probe',
        common,
        directory,
      ],
      { encoding: 'utf8', cwd: directory },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readFileSync(path.join(directory, '.git/index')), index);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'hosted maintenance shell scripts parse and Python recovery admission tests pass',
  { skip: !linux },
  () => {
    for (const file of ['common.sh', 'deploy.sh', 'backup.sh', 'update-from-ci.sh']) {
      const parsed = spawnSync('bash', ['-n', path.join(root, 'deploy/oracle-demo', file)], {
        encoding: 'utf8',
      });
      assert.equal(parsed.status, 0, parsed.stderr);
    }
    const result = spawnSync(
      'python3',
      ['-B', '-m', 'unittest', 'discover', '-s', 'deploy/oracle-demo/tests', '-p', 'test_*.py'],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
    );
    assert.equal(result.status, 0, result.stderr);
  },
);
