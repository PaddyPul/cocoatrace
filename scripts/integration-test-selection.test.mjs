import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { integrationSuiteArguments } from '../api/scripts/integration-test-selection.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('default preserves every suite; optional diagnostic file is passed to Vitest explicitly', () => {
  assert.deepEqual(integrationSuiteArguments([], root), []);
  assert.deepEqual(integrationSuiteArguments(['multiTenantApi.integration.test.ts'], root), [
    '--',
    'test/integration/multiTenantApi.integration.test.ts',
  ]);
});
test('suite selection refuses traversal, options, missing files and multiple suites', () => {
  for (const args of [
    ['../multiTenantApi.integration.test.ts'],
    ['--passWithNoTests'],
    ['missing.integration.test.ts'],
    ['multiTenantApi.integration.test.ts', 'catalogPagination.integration.test.ts'],
    ['C:\\private.integration.test.ts'],
  ])
    assert.throws(() => integrationSuiteArguments(args, root));
});
