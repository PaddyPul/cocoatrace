import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertDrillReport } from '../api/src/testing/recallDrill.ts';
const artifact = (root) => path.join(root, 'recall-drill-test-results', 'summary.json');
export function invalidateDrillEvidence(root) {
  fs.rmSync(artifact(root), { force: true });
}
export function checkDrillEvidence(root, commit) {
  const file = artifact(root);
  if (fs.statSync(file).size > 65536)
    throw new Error('Recall drill report exceeds its bounded size');
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertDrillReport(report, commit);
  return { status: 'passed', commit, scenarios: report.scenarios.length, scope: report.scope };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--invalidate'))
      throw new Error('Invalid drill command');
    if (process.argv[2] === '--invalidate') {
      invalidateDrillEvidence(root);
      console.log(JSON.stringify({ status: 'invalidated', scope: 'synthetic-disposable-native' }));
    } else {
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      console.log(JSON.stringify(checkDrillEvidence(root, commit)));
    }
  } catch {
    console.error(JSON.stringify({ status: 'failed', code: 'RECALL_DRILL_EVIDENCE_INVALID' }));
    process.exitCode = 1;
  }
}
