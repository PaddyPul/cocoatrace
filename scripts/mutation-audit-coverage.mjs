import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverRoutes, repositoryRoot } from './authorization-register.mjs';

export function mutationSurfaces(routes) {
  return routes
    .filter((route) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method))
    .map(({ method, path: routePath, source, handler }) => ({
      key: `${method} ${routePath}`,
      source,
      handler,
    }));
}

/** Coverage declarations are review evidence, not a proof of transactional behavior. */
export function validateMutationCoverage(register, surfaces, exists) {
  if (register.version !== 1 || !Array.isArray(register.routes) || !register.routes.length)
    throw new Error('Missing mutation audit inventory');
  const seen = new Set();
  const statuses = new Set(['covered', 'read-only', 'review-required']);
  for (const row of register.routes) {
    if (seen.has(row.key)) throw new Error(`Duplicate mutation surface: ${row.key}`);
    seen.add(row.key);
    const actual = surfaces.find((surface) => surface.key === row.key);
    if (!actual || actual.source !== row.source || actual.handler !== row.handler)
      throw new Error(`Changed mutation surface requires review: ${row.key}`);
    if (!statuses.has(row.status) || !row.boundary || !row.eventPolicy || !row.remaining)
      throw new Error(`Incomplete mutation review: ${row.key}`);
    if (!Array.isArray(row.evidence) || !row.evidence.length)
      throw new Error(`Missing mutation evidence: ${row.key}`);
    for (const file of row.evidence)
      if (
        typeof file !== 'string' ||
        !/^(api|docs)\//.test(file) ||
        file.includes('..') ||
        !exists(file)
      )
        throw new Error(`Missing mutation evidence: ${file}`);
  }
  for (const row of surfaces)
    if (!seen.has(row.key)) throw new Error(`Unreviewed mutation surface: ${row.key}`);
  if (!Array.isArray(register.background) || !register.background.length)
    throw new Error('Background mutation boundaries must be recorded separately');
  const backgroundNames = new Set();
  for (const row of register.background) {
    if (
      !row.name ||
      backgroundNames.has(row.name) ||
      !row.boundary ||
      !row.remaining ||
      !Array.isArray(row.evidence) ||
      !row.evidence.length
    )
      throw new Error('Incomplete or duplicate background boundary');
    backgroundNames.add(row.name);
    for (const file of row.evidence)
      if (
        typeof file !== 'string' ||
        !file.startsWith('api/') ||
        file.includes('..') ||
        !exists(file)
      )
        throw new Error(`Missing background evidence: ${file}`);
  }
  return {
    routes: surfaces.length,
    covered: register.routes.filter((row) => row.status === 'covered').length,
    readOnly: register.routes.filter((row) => row.status === 'read-only').length,
    reviewRequired: register.routes.filter((row) => row.status === 'review-required').length,
    background: register.background.length,
    inventoryOnly: true,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const register = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'docs/engineering/mutation-audit-coverage.json'),
      'utf8',
    ),
  );
  const result = validateMutationCoverage(register, mutationSurfaces(discoverRoutes()), (file) =>
    fs.existsSync(path.join(repositoryRoot, file)),
  );
  console.log(JSON.stringify({ status: 'passed', ...result }));
}
