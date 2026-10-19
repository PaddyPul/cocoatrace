import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateRouteEvidence(pages, documents, exists) {
  const covered = new Set();
  let entries = 0;
  function references(value) {
    if (
      typeof value === 'string' &&
      /^(?:web|api|e2e|scripts)\//.test(value) &&
      /\.(?:tsx?|mjs|json)$/.test(value)
    ) {
      if (value.includes('..') || !exists(value))
        throw new Error(`Missing route evidence: ${value}`);
    } else if (Array.isArray(value)) value.forEach(references);
    else if (value && typeof value === 'object') Object.values(value).forEach(references);
  }
  for (const document of documents) {
    const rows = document.entries || document.routes;
    if (!Array.isArray(rows) || !rows.length) throw new Error('Empty route evidence inventory');
    for (const row of rows) {
      if (typeof row.page !== 'string' || !row.evidence || !Array.isArray(row.remaining))
        throw new Error('Route evidence requires page, evidence and remaining acceptance');
      references(row.evidence);
      const page = row.page.replace(/\.tsx$/, '');
      if (pages.includes(page)) covered.add(page);
      entries++;
    }
  }
  const missing = pages.filter((page) => !covered.has(page));
  if (missing.length) throw new Error(`Route state audit missing: ${missing.join(', ')}`);
  return {
    pages: pages.length,
    entries,
    scope: 'source audit and test pointers; runtime/manual/device acceptance separate',
  };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = [
    'source-route-resilience.json',
    'trade-route-resilience.json',
    'admin-auth-route-resilience.json',
    'shared-route-resilience.json',
  ];
  const documents = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(root, 'docs/ux', file), 'utf8')),
  );
  const pages = fs
    .readdirSync(path.join(root, 'web/src/pages'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => file.slice(0, -4));
  const result = validateRouteEvidence(pages, documents, (file) =>
    fs.existsSync(path.join(root, file)),
  );
  console.log(JSON.stringify({ status: 'passed', inventoryOnly: true, ...result }));
}
