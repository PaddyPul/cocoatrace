import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRouteEvidence } from './route-resilience.mjs';
const row = {
  page: 'Page.tsx',
  evidence: ['e2e/page.spec.ts'],
  remaining: ['Actual browser acceptance required'],
};
test('new routes require explicit state audit evidence', () => {
  assert.throws(
    () => validateRouteEvidence(['Page', 'New'], [{ routes: [row] }], () => true),
    /New/,
  );
  assert.equal(validateRouteEvidence(['Page'], [{ routes: [row] }], () => true).pages, 1);
});
test('dangling test pointers and absent remaining acceptance fail', () => {
  assert.throws(
    () => validateRouteEvidence(['Page'], [{ entries: [row] }], () => false),
    /Missing route evidence/,
  );
  assert.throws(
    () =>
      validateRouteEvidence(
        ['Page'],
        [{ entries: [{ ...row, remaining: undefined }] }],
        () => true,
      ),
    /remaining acceptance/,
  );
});
