import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBacklog } from './backlog-progress.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const day = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function validateRiskRegister(data, backlogIds, exists) {
  if (
    !day(data.reviewedAt) ||
    !day(data.nextReview) ||
    data.nextReview < data.reviewedAt ||
    !data.owner?.trim() ||
    !Array.isArray(data.risks) ||
    !data.risks.length
  )
    throw new Error('Invalid risk review ownership or dates');
  const ids = new Set();
  for (const row of data.risks) {
    if (!/^RSK-\d{3}$/.test(row.id) || ids.has(row.id))
      throw new Error('Invalid or duplicate risk ID');
    ids.add(row.id);
    if (
      !['low', 'medium', 'high'].includes(row.likelihood) ||
      !['low', 'medium', 'high', 'critical'].includes(row.impact) ||
      !['open', 'mitigating', 'closed'].includes(row.status) ||
      !row.title?.trim() ||
      !row.mitigation?.trim()
    )
      throw new Error('Incomplete risk assessment');
    if (
      !row.backlog?.length ||
      !row.backlog.every((id) => backlogIds.has(id)) ||
      !exists(row.evidence)
    )
      throw new Error('Invalid risk evidence or backlog reference');
  }
  return data;
}
export function renderRisks(data) {
  const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `# Pilot risk register\n\nReviewed: ${data.reviewedAt}. Next review: ${data.nextReview}. Coordinating owner: ${data.owner}.\n\nThese are open operating risks, not accepted exceptions or evidence of hosted readiness. The owner coordinates review; independent review and operational staffing remain separate. Update likelihood, impact, mitigation and next date when evidence or scope changes. Run npm run risk:report to identify a due review; time alone never closes a risk.\n\n| Risk | Likelihood | Impact | Status | Mitigation / evidence | Backlog |\n| --- | --- | --- | --- | --- | --- |\n${data.risks.map((row) => `| ${cell(row.id)} — ${cell(row.title)} | ${row.likelihood} | ${row.impact} | ${row.status} | ${cell(row.mitigation)} [Evidence](${row.evidence.startsWith('docs/') ? row.evidence.slice(5) : '../' + row.evidence}) | ${row.backlog.join(', ')} |`).join('\n')}\n\nSource: risk-register.json. After editing, run node scripts/risk-register.mjs --write; commit the JSON and this view together. Reassess before each real pilot admission and record the review decision; automated checks cannot accept a risk on the founder’s behalf.\n`;
}
export function checkRisks(
  base = root,
  write = false,
  today = new Date().toISOString().slice(0, 10),
) {
  const ids = new Set(
    ['docs/DELIVERY_BACKLOG.md', 'docs/runbooks/FREE_STAGING_PLAN.md'].flatMap((name) =>
      parseBacklog(fs.readFileSync(path.join(base, name), 'utf8')).map((row) => row.id),
    ),
  );
  const data = validateRiskRegister(
    JSON.parse(fs.readFileSync(path.join(base, 'docs/risk-register.json'), 'utf8')),
    ids,
    (file) =>
      typeof file === 'string' &&
      !path.isAbsolute(file) &&
      !file.split('/').includes('..') &&
      fs.existsSync(path.join(base, file)),
  );
  const output = renderRisks(data),
    target = path.join(base, 'docs/RISK_REGISTER.md');
  if (write) fs.writeFileSync(target, output);
  // Git may materialize CRLF on Windows; compare content without treating that as drift.
  else if (fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== output)
    throw new Error('Risk register view is stale; regenerate explicitly');
  return {
    status: 'passed',
    risks: data.risks.length,
    reviewedAt: data.reviewedAt,
    nextReview: data.nextReview,
    reviewDue: today >= data.nextReview,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== '--write'))
    throw new Error('Use no arguments or --write');
  console.log(JSON.stringify(checkRisks(root, process.argv.includes('--write'))));
}
