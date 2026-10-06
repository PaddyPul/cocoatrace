import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseBacklog(markdown) {
  return [...markdown.matchAll(/^- \[([ x-])\] \*\*([A-Z]+-\d+)\b([^\n]*?):\*\*/gm)].map(
    ([, marker, id, header]) => ({
      id,
      status:
        marker === 'x'
          ? 'complete'
          : marker === '-' || /IN PROGRESS/.test(header)
            ? 'partial'
            : 'open',
    }),
  );
}

export function summarize(items) {
  const total = items.length;
  const complete = items.filter((item) => item.status === 'complete').length;
  const partial = items.filter((item) => item.status === 'partial').length;
  const blocked = items.filter((item) => item.status === 'blocked').length;
  return {
    total,
    complete,
    partial,
    blocked,
    open: total - complete - partial - blocked,
    completedPercent: total ? Number(((100 * complete) / total).toFixed(1)) : 0,
  };
}

export function progress(root) {
  const rows = ['docs/DELIVERY_BACKLOG.md', 'docs/runbooks/FREE_STAGING_PLAN.md'].flatMap((name) =>
    parseBacklog(fs.readFileSync(path.join(root, name), 'utf8')),
  );
  const ids = new Set();
  for (const item of rows) {
    if (ids.has(item.id)) throw new Error(`Duplicate backlog ID: ${item.id}`);
    ids.add(item.id);
  }
  const register = JSON.parse(fs.readFileSync(path.join(root, 'docs/pilot-gates.json'), 'utf8'));
  const gateIds = new Set();
  for (const gate of register.gates) {
    if (gateIds.has(gate.id)) throw new Error(`Duplicate pilot gate: ${gate.id}`);
    gateIds.add(gate.id);
    if (
      !['core', 'provider'].includes(gate.scope) ||
      !['complete', 'partial', 'blocked', 'open'].includes(gate.status)
    )
      throw new Error(`Invalid pilot gate: ${gate.id}`);
    if (!gate.title || !gate.evidence || !gate.backlog?.length)
      throw new Error(`Missing gate evidence: ${gate.id}`);
    for (const id of gate.backlog)
      if (!ids.has(id)) throw new Error(`Unknown backlog reference: ${id}`);
  }
  return {
    reviewedAt: register.reviewedAt,
    roadmap: summarize(rows),
    corePilot: summarize(register.gates.filter((gate) => gate.scope === 'core')),
    providerAdditionalGates: summarize(register.gates.filter((gate) => gate.scope === 'provider')),
    providerLaunchIncludingCore: summarize(register.gates),
    note: register.method,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(progress(root), null, 2));
}
