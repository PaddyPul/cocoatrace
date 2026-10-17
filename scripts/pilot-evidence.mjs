import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBacklog } from './backlog-progress.mjs';

const text = (value) =>
  typeof value === 'string' && value.trim().length > 0 && !/[\r\n|<>]/.test(value);
export function validateCapabilities(data, backlog, exists) {
  if (
    data.version !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt) ||
    !text(data.scope) ||
    !Array.isArray(data.capabilities) ||
    !data.capabilities.length
  )
    throw new Error('Invalid capability register');
  const ids = new Set();
  for (const row of data.capabilities) {
    if (
      !row ||
      !/^[a-z][a-z0-9-]*$/.test(row.id) ||
      ids.has(row.id) ||
      !text(row.title) ||
      !text(row.limits) ||
      !['current', 'partial', 'planned'].includes(row.status)
    )
      throw new Error('Invalid or duplicate capability');
    ids.add(row.id);
    if (
      !Array.isArray(row.backlog) ||
      !row.backlog.length ||
      row.backlog.some((id) => !backlog.has(id))
    )
      throw new Error(`Untracked capability ${row.id}`);
    const statuses = row.backlog.map((id) => backlog.get(id));
    if (row.status === 'current' && statuses.some((status) => status !== 'complete'))
      throw new Error(`Current capability has unfinished acceptance: ${row.id}`);
    if (row.status !== 'current' && statuses.every((status) => status === 'complete'))
      throw new Error(`Capability status requires review: ${row.id}`);
    if (
      !Array.isArray(row.evidence) ||
      !row.evidence.length ||
      row.evidence.some(
        (file) =>
          typeof file !== 'string' ||
          !/^(api|web|docs|scripts|e2e)\/[A-Za-z0-9_./-]+$/.test(file) ||
          file.split('/').includes('..') ||
          !exists(file),
      )
    )
      throw new Error(`Missing or unsafe source evidence: ${row.id}`);
  }
}
export function renderCapabilities(data) {
  const labels = {
    current: 'Current: local release accepted',
    partial: 'Partial: limits remain',
    planned: 'Roadmap: acceptance open',
  };
  return `# BetterTrade current versus roadmap capabilities\n\nReviewed ${data.reviewedAt} · INV-005 · Generated from [capabilities.json](capabilities.json).\n\n${data.scope}\n\nCurrent means the referenced backlog criteria have founder-reported local release/merge acceptance. It does not assert independent security review, hosted operation, legal approval, verified third-party claims or a valuation. Partial and roadmap rows are not sold as completed capabilities.\n\n| Capability | State | Boundary and remaining work | Backlog and source evidence |\n| --- | --- | --- | --- |\n${data.capabilities.map((row) => `| ${row.title} | ${labels[row.status]} | ${row.limits} | ${row.backlog.join(', ')}; ${row.evidence.map((file) => `[${file}](../../${file})`).join(', ')} |`).join('\n')}\n\n## Maintain the evidence\n\nReview source and backlog before changing a claim. Update JSON explicitly, then run \`node scripts/pilot-evidence.mjs --write\` and \`npm run check:pilot-evidence\`. The check rejects unsupported current claims, unknown backlog IDs, missing source files and stale generated output (LF/CRLF materialization is equivalent). It checks traceability, not runtime behavior or semantic completeness. Required release/CI must still pass.\n\nRead the [architecture/security overview](ARCHITECTURE_SECURITY_OVERVIEW.md), [pilot gates](../pilot-gates.json), [backlog](../DELIVERY_BACKLOG.md) and [risk register](../RISK_REGISTER.md) before presenting pilot readiness.\n`;
}
export function checkPilotEvidence(root, write = false) {
  const backlog = new Map(
    ['docs/DELIVERY_BACKLOG.md', 'docs/runbooks/FREE_STAGING_PLAN.md']
      .flatMap((file) => parseBacklog(fs.readFileSync(path.join(root, file), 'utf8')))
      .map((row) => [row.id, row.status]),
  );
  const data = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/investor/capabilities.json'), 'utf8'),
  );
  validateCapabilities(
    data,
    backlog,
    (file) => fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() === true,
  );
  const overview = path.join(root, 'docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md');
  const overviewText = fs.readFileSync(overview, 'utf8');
  const overviewLinks = [...overviewText.matchAll(/\]\(([^)]+)\)/g)];
  if (
    !overviewText.startsWith('# BetterTrade') ||
    !overviewText.includes('INV-004') ||
    new Set(overviewLinks.map(([, href]) => href)).size < 8
  )
    throw new Error('Architecture overview requires reviewed source boundaries');
  for (const [, href] of overviewLinks) {
    const resolved = path.resolve(path.dirname(overview), href);
    if (
      !href.startsWith('../') ||
      !resolved.startsWith(root + path.sep) ||
      !fs.statSync(resolved, { throwIfNoEntry: false })?.isFile()
    )
      throw new Error('Architecture overview source link is unavailable');
  }
  const target = path.join(root, 'docs/investor/CAPABILITY_MATRIX.md'),
    rendered = renderCapabilities(data);
  if (write) fs.writeFileSync(target, rendered);
  else if (fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== rendered)
    throw new Error('Capability matrix is stale; regenerate explicitly');
  return {
    status: 'passed',
    reviewedAt: data.reviewedAt,
    capabilities: data.capabilities.length,
    scope: 'Repository traceability; runtime and hosted acceptance remain separate',
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== '--write'))
    throw new Error('Use no arguments or --write');
  console.log(
    JSON.stringify(
      checkPilotEvidence(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
        process.argv.includes('--write'),
      ),
    ),
  );
}
