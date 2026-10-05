import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'api/package.json'));
assert.notEqual(process.getuid?.(), 0, 'API runtime must use a non-root user');
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
