import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkScriptContracts, commandTokens } from './check-script-contracts.mjs';

function fixture(t, scripts, apiScripts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'script-contracts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'api', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', workspaces: ['api'], scripts }),
  );
  fs.writeFileSync(
    path.join(root, 'api', 'package.json'),
    JSON.stringify({ name: 'api', scripts: apiScripts }),
  );
  fs.writeFileSync(path.join(root, 'api', 'src', 'server.ts'), '// source');
  fs.writeFileSync(path.join(root, 'scripts', 'real file.mjs'), '// runner');
  return root;
}

test('current repository script contracts resolve without executing runners', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(checkScriptContracts(root), []);
});

test('rejects missing node and tsx runners, including command chains', (t) => {
  const root = fixture(t, {
    broken: 'vite build && node scripts/missing.mjs',
    typed: 'tsx api/scripts/missing.ts',
  });
  const errors = checkScriptContracts(root);
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /missing\.mjs/);
  assert.match(errors.join('\n'), /missing\.ts/);
});

test('checks workspace delegation names and supported clean-checkout build sources', (t) => {
  const root = fixture(
    t,
    {
      start: 'npm run start --workspace=api',
      absent: 'npm run nonexistent -w api',
      workspace: 'npm run start --workspace=ghost',
    },
    { start: 'node dist/server.js' },
  );
  const errors = checkScriptContracts(root);
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /missing delegated script api:nonexistent/);
  assert.match(errors.join('\n'), /unknown workspace ghost/);
});

test('accepts quoted filenames and Windows separators without running shell code', (t) => {
  const root = fixture(t, {
    quoted: 'node "scripts/real file.mjs"',
    windows: 'tsx api\\src\\server.ts',
    inline: 'node --eval "throw new Error()"',
  });
  assert.deepEqual(checkScriptContracts(root), []);
  assert.deepEqual(commandTokens('node "scripts/real file.mjs" && vite build'), [
    'node',
    'scripts/real file.mjs',
    ';',
    'vite',
    'build',
  ]);
});

test('rejects obsolete aliases even if an accidental local file appears', (t) => {
  const root = fixture(t, {}, { 'db:migrate:js': 'node dist/server.js' });
  assert.match(checkScriptContracts(root).join('\n'), /obsolete alias/);
});

test('rejects nonexistent emitted output without a corresponding source and malformed quotes', (t) => {
  const root = fixture(
    t,
    { malformed: 'node "scripts/runner.mjs' },
    { start: 'node dist/missing.js' },
  );
  assert.equal(checkScriptContracts(root).length, 2);
});
