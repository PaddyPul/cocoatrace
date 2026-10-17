import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertPilotLoadReport } from '../api/src/testing/pilotLoadReport.ts';
const artifact = (root) => path.join(root, 'pilot-load-test-results', 'summary.json');
export function invalidateLoadEvidence(root) {
  fs.rmSync(artifact(root), { force: true });
}
export function checkLoadEvidence(root, commit) {
  const file = artifact(root);
  if (fs.statSync(file).size > 65536) throw new Error('Oversized load report');
  const policy = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/performance/capacity-policy.json'), 'utf8'),
  );
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertPilotLoadReport(report, commit, policy.loadTargets);
  return { status: 'passed', commit, workloads: report.workloads.length, scope: report.scope };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--invalidate'))
      throw new Error('Invalid command');
    if (process.argv[2]) {
      invalidateLoadEvidence(root);
      console.log(
        JSON.stringify({ status: 'invalidated', scope: 'synthetic-local-http-postgres' }),
      );
    } else {
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      console.log(JSON.stringify(checkLoadEvidence(root, commit)));
    }
  } catch {
    console.error(JSON.stringify({ status: 'failed', code: 'PILOT_LOAD_EVIDENCE_INVALID' }));
    process.exitCode = 1;
  }
}
