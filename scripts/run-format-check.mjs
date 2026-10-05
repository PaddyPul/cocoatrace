import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { formattedPaths } from './quality-scope.mjs';

const require = createRequire(import.meta.url);
const write = process.argv.includes('--write');
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [require.resolve('prettier/bin/prettier.cjs'), write ? '--write' : '--check', ...formattedPaths],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
