import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
// Resolve the actual command runner's dependency, including a nested install.
const runnerRequire = createRequire(require.resolve('concurrently/package.json'));
const { quote, parse } = runnerRequire('shell-quote');

test('shell quoting rejects line terminators after comment tokens without executing commands', () => {
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => quote(['echo', { comment: 'synthetic' }, `first${separator}second`]), TypeError);
    assert.throws(() => quote(['echo', { comment: 'synthetic' }, 'intervening', `first${separator}second`]), TypeError);
  }
  assert.throws(() => quote([...parse('echo http://example.test/#fragment'), 'first\nsecond']), TypeError);
});

test('ordinary command arguments retain literal values through quote and parse', () => {
  const values = ['echo', 'space separated', 'literal;value', 'a"b', ''];
  assert.deepEqual(parse(quote(values)), values);
  assert.equal(quote(['echo', { comment: 'note' }, 'ordinary']), 'echo #note ordinary');
});
