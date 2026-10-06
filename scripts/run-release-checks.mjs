import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseChecks = [
  ['Code quality', ['run', 'check:quality']],
  ['Workspace type checks', ['run', 'typecheck']],
  ['Dependency advisories', ['run', 'check:dependencies']],
  [
    'Runner checks',
    [
      '--test',
      'scripts/run-release-checks.test.mjs',
      'scripts/check-dependencies.test.mjs',
      'scripts/shell-quote-security.test.mjs',
      'scripts/check-container-security.test.mjs',
      'scripts/compose-compatibility.test.mjs',
      'scripts/demo-preview.test.mjs',
    ],
    true,
  ],
  [
    'Browser inbox isolation',
    ['--import', 'tsx', '--test', 'scripts/inbox-isolation.test.mjs'],
    true,
  ],
  ['Language foundation tests', ['run', 'test:locale']],
  ['API unit tests', ['run', 'test', '--workspace=api']],
  ['API build', ['run', 'build', '--workspace=api']],
  ['Web build', ['run', 'build', '--workspace=web']],
  ['Browser type checks', ['run', 'typecheck:browser']],
  ['Migration integrity', ['run', 'migrations:verify', '--workspace=api']],
  ['Container runtime and vulnerability checks', ['run', 'check:containers']],
  ['Fresh and upgrade migrations', ['run', 'test:migrations:docker']],
  ['Database/storage/scanner integration', ['run', 'test:integration:docker']],
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

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run through npm: npm run verify:release');
  const result = runReleaseChecks((args, directNode) => {
    const child = spawnSync(process.execPath, directNode ? args : [npmCli, ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    if (child.error) throw child.error;
    return child.status ?? 1;
  });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const report = {
    ...result,
    commit: revision.status === 0 ? revision.stdout.trim() : null,
    completedAt: new Date().toISOString(),
  };
  const directory = path.join(root, 'release-test-results');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(report, null, 2));
  console.log(`\nRelease checks: ${report.status}. Report: release-test-results/summary.json`);
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
