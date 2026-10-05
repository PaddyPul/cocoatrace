import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'api/package.json'));
assert.notEqual(process.getuid?.(), 0, 'API runtime must use a non-root user');
for (const file of [
  '/usr/local/lib/node_modules/npm',
  '/usr/local/lib/node_modules/corepack',
  '/usr/local/bin/npm',
  '/usr/local/bin/npx',
  '/usr/local/bin/yarn',
  '/usr/local/bin/yarnpkg',
]) {
  assert.equal(fs.existsSync(file), false, `Package manager must not be shipped: ${file}`);
}
assert.ok(
  !fs.readdirSync('/opt').some((name) => name.startsWith('yarn')),
  'Yarn packages must not be shipped',
);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'api/package.json'), 'utf8'));
for (const dependency of Object.keys(manifest.dependencies)) require.resolve(dependency);
for (const forbidden of ['vitest', 'vite', 'typescript', 'eslint', 'pino-pretty']) {
  assert.throws(
    () => require.resolve(forbidden),
    { code: 'MODULE_NOT_FOUND' },
    `${forbidden} must not be shipped`,
  );
}
for (const file of [
  'api/dist/server.js',
  'api/src/migrations/001_initial_schema.ts',
  'api/scripts/migrate.ts',
  'api/knexfile.ts',
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing runtime asset ${file}`);
}
assert.equal(
  fs.existsSync(path.join(root, 'package-lock.json')),
  false,
  'Runtime must not retain the full build lockfile',
);
execFileSync(process.execPath, [path.join(root, 'api/scripts/check-migration-integrity.mjs')], {
  stdio: 'inherit',
});
console.log('PASS: non-root runtime, production dependencies and original migration assets');
