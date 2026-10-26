import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseChecks = [
  ['Code quality', ['run', 'check:quality']],
  ['Workspace type checks', ['run', 'typecheck']],
  ['Dependency advisories', ['run', 'check:dependencies']],
  ['Committed secret scan', ['run', 'check:secrets']],
  [
    'Runner checks',
    [
      '--test',
      'scripts/run-release-checks.test.mjs',
      'scripts/release-candidate.test.mjs',
      'scripts/recovery-objects.test.mjs',
      'scripts/secret-scan.test.mjs',
      'scripts/build-metadata.test.mjs',
      'scripts/check-dependencies.test.mjs',
      'scripts/shell-quote-security.test.mjs',
      'scripts/check-container-security.test.mjs',
      'scripts/compose-compatibility.test.mjs',
      'scripts/demo-preview.test.mjs',
      'scripts/email-rehearsal.test.mjs',
      'scripts/run-evidence-stress.test.mjs',
      'scripts/integration-test-selection.test.mjs',
      'scripts/integration-storage-readiness.test.mjs',
    ],
    true,
  ],
  [
    'Browser inbox isolation',
    [
      '--import',
      'tsx',
      '--test',
      'scripts/inbox-isolation.test.mjs',
      'scripts/browser-navigation.test.mjs',
    ],
    true,
  ],
  ['Language foundation tests', ['run', 'test:locale']],
  ['Workspace route-state evidence', ['run', 'check:workspace-states']],
  ['Critical-domain regression evidence', ['run', 'check:regressions']],
  ['Pilot risk register', ['run', 'check:risks']],
  ['Pilot architecture and capability evidence', ['run', 'check:pilot-evidence']],
  ['Frontend HTTP boundaries', ['run', 'test:web-boundaries']],
  ['Workspace filters and support context', ['run', 'test:workspace-tools']],
  ['Authorization route register', ['run', 'check:authorization']],
  ['Mutation audit inventory', ['run', 'check:mutation-audits']],
  ['Branding and compatibility', ['run', 'check:branding']],
  ['Pilot load evidence contracts', ['run', 'test:pilot-load']],
  ['Recall drill evidence contracts', ['run', 'test:recall-drill']],
  ['API unit tests', ['run', 'test', '--workspace=api']],
  ['API build', ['run', 'build', '--workspace=api']],
  ['Web build', ['run', 'build', '--workspace=web']],
  ['Initial frontend JavaScript budget', ['run', 'check:web-budget']],
  ['Browser type checks', ['run', 'typecheck:browser']],
  ['Migration integrity', ['run', 'migrations:verify', '--workspace=api']],
  ['Container runtime and vulnerability checks', ['run', 'check:containers']],
  ['Fresh and upgrade migrations', ['run', 'test:migrations:docker']],
  [
    'Invalidate previous recall drill evidence',
    ['--import', 'tsx', 'scripts/recall-drill.mjs', '--invalidate'],
    true,
  ],
  [
    'Invalidate previous pilot load evidence',
    ['--import', 'tsx', 'scripts/pilot-load.mjs', '--invalidate'],
    true,
  ],
  ['Database/storage/scanner integration', ['run', 'test:integration:docker']],
  ['Recorded pilot load evidence', ['run', 'check:pilot-load']],
  ['Recorded recall tabletop evidence', ['run', 'check:recall-drill']],
  ['Evidence transfer memory stress', ['run', 'test:evidence:stress:docker']],
  ['Browser journeys', ['run', 'test:browser:docker']],
  ['Backup and restore rehearsal', ['run', 'test:recovery:docker']],
];

/** Fail fast, while recording every unexecuted gate explicitly. Never imply those gates passed. */
export function runReleaseChecks(execute, checks = releaseChecks) {
  const results = [];
  let failed = false;
  for (const [name, args, directNode = false] of checks) {
    if (failed) {
      results.push({ name, status: 'not_run' });
      continue;
    }
    console.log(`\nRelease gate: ${name}`);
    const started = Date.now();
    let exitCode = 1;
    try {
      exitCode = execute(args, directNode);
    } catch {
      /* Unexpected launch failures are failed gates. */
    }
    const passed = exitCode === 0;
    results.push({
      name,
      status: passed ? 'passed' : 'failed',
      exitCode,
      durationMs: Date.now() - started,
    });
    failed = !passed;
  }
  return { status: failed ? 'failed' : 'passed', checks: results };
}

export function captureCandidate(root) {
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Cannot inspect release candidate Git state');
    return result.stdout.trim();
  };
  const commit = git(['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release candidate commit');
  if (git(['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error('Commit or remove pending changes before release verification');
  }
  return { commit, branch: git(['symbolic-ref', '--quiet', '--short', 'HEAD']) };
}

export function verifyCandidate(before, after) {
  if (before.commit !== after.commit || before.branch !== after.branch) {
    throw new Error('Release candidate changed during verification');
  }
}

export function verifyRelease(root, execute, checks = releaseChecks) {
  const directory = path.join(root, 'release-test-results');
  fs.mkdirSync(directory, { recursive: true });
  const summary = path.join(directory, 'summary.json');
  fs.rmSync(summary, { force: true });
  const startedAt = new Date().toISOString();
  let candidate = null;
  let result = { status: 'failed', checks: [] };
  let candidateError;
  try {
    candidate = captureCandidate(root);
    result = runReleaseChecks(execute, checks);
    verifyCandidate(candidate, captureCandidate(root));
  } catch (error) {
    result.status = 'failed';
    candidateError = error.message;
  }
  const report = {
    ...result,
    commit: candidate?.commit ?? null,
    branch: candidate?.branch ?? null,
    startedAt,
    completedAt: new Date().toISOString(),
    ...(candidateError ? { candidateError } : {}),
  };
  fs.writeFileSync(summary, JSON.stringify(report, null, 2));
  return report;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run through npm: npm run verify:release');
  const report = verifyRelease(root, (args, directNode) => {
    const child = spawnSync(process.execPath, directNode ? args : [npmCli, ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    if (child.error) throw child.error;
    return child.status ?? 1;
  });
  console.log(`\nRelease checks: ${report.status}. Report: release-test-results/summary.json`);
  if (report.candidateError) console.error(report.candidateError);
  process.exitCode = report.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
