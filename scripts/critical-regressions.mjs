import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateRegisters(coverage, regressions, read) {
  if (coverage.version !== 1 || !Array.isArray(coverage.domains) || coverage.domains.length < 7)
    throw new Error('Critical-domain coverage register incomplete');
  const ids = new Set();
  for (const row of coverage.domains) {
    if (!row.id || ids.has(row.id) || !row.ownerRole || !row.gap || !row.scenarios?.length)
      throw new Error(
        'Coverage domain requires unique identity, accountable role, scenarios and gaps',
      );
    ids.add(row.id);
    const source = read(row.suite);
    for (const title of row.scenarios) {
      if (!source.includes(title)) throw new Error(`Missing registered scenario: ${row.id}`);
    }
    if (!/\bexpect\s*\(|\bassert[.(]/.test(source))
      throw new Error('Registered suite has no assertions');
  }
  if (regressions.version !== 1 || !Array.isArray(regressions.defects))
    throw new Error('Invalid P0 register');
  const defectIds = new Set();
  for (const defect of regressions.defects) {
    if (
      !/^P0-[A-Z0-9-]+$/.test(defect.id) ||
      defectIds.has(defect.id) ||
      !defect.failure ||
      !defect.testTitle
    )
      throw new Error('Invalid or duplicate P0 defect');
    defectIds.add(defect.id);
    if (!read(defect.suite).includes(defect.testTitle))
      throw new Error('P0 regression scenario missing');
  }
  return {
    domains: ids.size,
    scenarios: coverage.domains.reduce((n, row) => n + row.scenarios.length, 0),
    defects: defectIds.size,
  };
}

export function validatePullRequest(event, regressions) {
  const pr = event.pull_request;
  if (!pr) return;
  const body = pr.body || '';
  const p0 =
    pr.labels?.some((label) => /^severity[:/]p0$/i.test(label.name)) ||
    /Defect severity:\s*P0\b/i.test(body);
  if (!p0) return;
  const linked = regressions.defects.filter((row) => body.includes(row.id));
  if (!linked.length) throw new Error('Confirmed P0 PR requires a registered regression ID');
}

export function report(coverage, counts) {
  return `# Critical-domain scenario coverage\n\n${coverage.measurement}\n\nRegistered domains: ${counts.domains}; scenarios: ${counts.scenarios}. These counts are inventory, not pass rates.\n\n${coverage.domains.map((row) => `## ${row.id}\n\nAccountable role: ${row.ownerRole}. Suite: ${row.suite}\n\n${row.scenarios.map((title) => `- ${title}`).join('\n')}\n\nRemaining: ${row.gap}\n`).join('\n')}\nRegenerate with npm run quality:report. Current execution evidence: release-test-results/summary.json and private/sanitized suite reports for the exact candidate commit. A missing/failed/skipped report does not establish a pass.\n`;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--write', '--pr'].includes(arg)))
    throw new Error('Use --write or --pr');
  const coverage = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/quality/critical-domain-coverage.json'), 'utf8'),
  );
  const regressions = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/quality/p0-regressions.json'), 'utf8'),
  );
  const read = (file) => {
    if (
      !/^(?:api\/(?:src|test)|e2e)\/[\w/.-]+\.(?:test|spec)\.tsx?$/.test(file) ||
      file.includes('..')
    )
      throw new Error('Regression must reference a repository test');
    return fs.readFileSync(path.join(root, file), 'utf8');
  };
  const counts = validateRegisters(coverage, regressions, read);
  const destination = path.join(root, 'docs/quality/CRITICAL_DOMAIN_COVERAGE.md');
  const rendered = report(coverage, counts);
  if (args.includes('--write')) fs.writeFileSync(destination, rendered);
  else if (
    !fs.existsSync(destination) ||
    fs.readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== rendered
  )
    throw new Error('Scenario report stale; run npm run quality:report');
  if (args.includes('--pr') && process.env.GITHUB_EVENT_PATH)
    validatePullRequest(
      JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      regressions,
    );
  console.log(JSON.stringify({ status: 'passed', inventoryOnly: true, ...counts }));
}
