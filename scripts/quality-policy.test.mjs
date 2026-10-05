import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';

const eslint = new ESLint();

test('payment and delivery code cannot introduce explicit any', async () => {
  for (const filePath of [
    'api/src/modules/payments/policy-probe.ts',
    'api/src/modules/delivery/policy-probe.ts',
  ]) {
    const [result] = await eslint.lintText('export const unsafe = (value: any) => value;', {
      filePath,
    });
    assert.ok(
      result.messages.some((message) => message.ruleId === '@typescript-eslint/no-explicit-any'),
    );
  }
});

test('strict feature modules reject unused variables but allow intentional underscore arguments', async () => {
  const [bad] = await eslint.lintText('const abandoned = 1; export const live = 2;', {
    filePath: 'api/src/modules/payments/policy-probe.ts',
  });
  assert.ok(bad.messages.some((message) => message.ruleId === '@typescript-eslint/no-unused-vars'));
  const [good] = await eslint.lintText('export const value = (_actor: string) => 1;', {
    filePath: 'api/src/modules/delivery/policy-probe.ts',
  });
  assert.equal(good.errorCount, 0);
});

test('frozen migration files remain outside automatic lint and format rewriting', async () => {
  const file = 'api/src/migrations/001_initial_schema.ts';
  assert.equal(await eslint.isPathIgnored(file), true);
  assert.equal((await prettier.getFileInfo(file, { ignorePath: '.prettierignore' })).ignored, true);
});
