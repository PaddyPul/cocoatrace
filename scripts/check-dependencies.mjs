import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Every leaf advisory must be resolved or covered by a current, dev-only exception. */
export function evaluateAudit(report, lock, exceptions, now = new Date(), production = false) {
  if (
    report?.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    Array.isArray(report.vulnerabilities) ||
    report.error
  ) {
    throw new Error('Audit service did not return a valid version-2 report');
  }
  const failures = [];
  const accepted = [];
  const seen = new Set();
  function visit(name, ancestors = new Set()) {
    const finding = report.vulnerabilities[name];
    if (
      !finding ||
      !Array.isArray(finding.via) ||
      finding.via.length === 0 ||
      ancestors.has(name)
    ) {
      failures.push(`${name}: unresolved advisory dependency`);
      return;
    }
    for (const via of finding.via) {
      if (typeof via === 'string') {
        visit(via, new Set([...ancestors, name]));
        continue;
      }
      const advisory = via.url?.match(/^https:\/\/github\.com\/advisories\/(GHSA-[\w-]+)$/)?.[1];
      const key = `${name}:${advisory ?? via.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const nodes = finding.nodes;
      const permitted =
        !production &&
        advisory &&
        Array.isArray(nodes) &&
        nodes.length > 0 &&
        exceptions.some(
          (item) =>
            item.advisory === advisory &&
            item.package === name &&
            item.scope === 'development-only' &&
            item.reason &&
            item.owner &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.expires) &&
            Number.isFinite(Date.parse(`${item.expires}T00:00:00Z`)) &&
            now.getTime() < Date.parse(`${item.expires}T00:00:00Z`) &&
            nodes.every(
              (node) =>
                lock.packages?.[node]?.dev === true && lock.packages[node].version === item.version,
            ),
        );
      const message = `${name}: ${advisory ?? 'unknown advisory'} (${via.severity ?? finding.severity})`;
      if (permitted) accepted.push(message);
      else failures.push(message);
    }
  }
  for (const name of Object.keys(report.vulnerabilities)) visit(name);
  return {
    status: failures.length ? 'failed' : 'passed',
    failures: [...new Set(failures)],
    accepted,
  };
}

export function auditWithNpm(npmCli, root, production = false) {
  const result = spawnSync(
    process.execPath,
    [npmCli, 'audit', '--json', ...(production ? ['--omit=dev'] : [])],
    { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.error || ![0, 1].includes(result.status))
    throw new Error('npm audit could not complete');
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error('npm audit returned invalid JSON');
  }
  return report;
}

export function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run through npm run check:dependencies');
  const output = path.join(root, 'dependency-test-results');
  fs.mkdirSync(output, { recursive: true });
  let summary;
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const exceptions = JSON.parse(
      fs.readFileSync(path.join(root, 'security/dependency-exceptions.json'), 'utf8'),
    );
    if (!Array.isArray(exceptions)) throw new Error('Dependency exceptions must be an array');
    const production = evaluateAudit(auditWithNpm(npmCli, root, true), lock, [], new Date(), true);
    const complete = evaluateAudit(auditWithNpm(npmCli, root), lock, exceptions);
    summary = {
      status: production.status === 'passed' && complete.status === 'passed' ? 'passed' : 'failed',
      completedAt: new Date().toISOString(),
      production,
      complete,
    };
  } catch (error) {
    summary = { status: 'failed', completedAt: new Date().toISOString(), error: error.message };
  }
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log('Dependency report: dependency-test-results/summary.json');
  process.exitCode = summary.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
