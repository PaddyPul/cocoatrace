import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browserSuiteArguments } from './browser-suite-selection.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('default runs every browser test; focused selection retains explicit existing suites', () => {
  assert.deepEqual(browserSuiteArguments([], root), []);
  assert.deepEqual(
    browserSuiteArguments(['contractPages.spec.ts', 'languageFoundation.spec.ts'], root),
    ['e2e/contractPages.spec.ts', 'e2e/languageFoundation.spec.ts'],
  );
});
test('selection rejects flags, traversal, missing files and oversized selections', () => {
  for (const args of [
    ['--pass-with-no-tests'],
    ['../contractPages.spec.ts'],
    ['missing.spec.ts'],
    Array(9).fill('contractPages.spec.ts'),
  ])
    assert.throws(() => browserSuiteArguments(args, root));
});
