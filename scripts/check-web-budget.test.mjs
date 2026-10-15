import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { measureInitialJavaScript, enforceInitialJavaScriptBudget } from './check-web-budget.mjs';

test('includes transitive static imports once and excludes lazy route downloads', () => {
  const manifest = {
    entry: {
      isEntry: true,
      file: 'entry.js',
      imports: ['shared', 'other'],
      dynamicImports: ['route'],
    },
    shared: { file: 'shared.js' },
    other: { file: 'other.js', imports: ['shared'] },
    route: { file: 'route.js' },
  };
  const reads = [];
  const result = measureInitialJavaScript(manifest, (file) => {
    reads.push(file);
    return Buffer.from(file);
  });
  assert.deepEqual(reads, ['entry.js', 'shared.js', 'other.js']);
  assert.equal(result.initialChunks, 3);
  assert.equal(result.rawBytes, Buffer.byteLength(reads.join('')));
  enforceInitialJavaScriptBudget(result);
});
test('fails closed on missing or ambiguous production manifests', () => {
  assert.throws(() => measureInitialJavaScript({}, () => Buffer.alloc(0)), /one production entry/);
  assert.throws(
    () =>
      measureInitialJavaScript({ a: { isEntry: true, file: 'a.js', imports: ['absent'] } }, () =>
        Buffer.alloc(0),
      ),
    /Missing JavaScript/,
  );
});
test('actual compressed transfer bytes over the budget fail', () => {
  const result = measureInitialJavaScript({ a: { isEntry: true, file: 'a.js' } }, () =>
    randomBytes(200 * 1024),
  );
  assert.throws(() => enforceInitialJavaScriptBudget(result), /exceeds/);
});
