import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationSurfaces, validateMutationCoverage } from './mutation-audit-coverage.mjs';
const surfaces = [{ key: 'POST /items', source: 'api/items.ts', handler: 'create' }];
const register = () => ({
  version: 1,
  routes: [
    {
      ...surfaces[0],
      status: 'covered',
      boundary: 'database transaction',
      eventPolicy: 'no external event required',
      remaining: 'Runtime acceptance separate',
      evidence: ['api/items.test.ts'],
    },
  ],
  background: [
    {
      name: 'worker',
      boundary: 'claim/complete',
      remaining: 'Hosted drill',
      evidence: ['api/worker.ts'],
    },
  ],
});
test('enumerates POST computations as well as every HTTP write method for explicit disposition', () => {
  assert.deepEqual(
    mutationSurfaces(
      ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((method) => ({
        method,
        path: '/items',
        source: 'api/items.ts',
        handler: 'create',
      })),
    ).map((r) => r.key),
    ['POST /items', 'PATCH /items', 'PUT /items', 'DELETE /items'],
  );
});
test('new, removed, moved and changed-handler routes require a reviewed entry', () => {
  for (const actual of [
    [],
    [...surfaces, { ...surfaces[0], key: 'PUT /items' }],
    [{ ...surfaces[0], source: 'api/new.ts' }],
    [{ ...surfaces[0], handler: 'replace' }],
  ])
    assert.throws(() => validateMutationCoverage(register(), actual, () => true));
});
test('rejects duplicates, missing evidence, invalid status and undeclared external-event policy', () => {
  for (const mutate of [
    (r) => r.routes.push(r.routes[0]),
    (r) => (r.routes[0].status = 'done'),
    (r) => (r.routes[0].evidence = []),
    (r) => (r.routes[0].evidence = ['api/../secret']),
    (r) => (r.routes[0].eventPolicy = ''),
    (r) => (r.background = []),
  ]) {
    const r = register();
    mutate(r);
    assert.throws(() => validateMutationCoverage(r, surfaces, () => true));
  }
  assert.throws(() => validateMutationCoverage(register(), surfaces, () => false));
});
test('reports open reviews without pretending source pointers prove runtime behavior', () => {
  const r = register();
  r.routes[0].status = 'review-required';
  assert.deepEqual(
    validateMutationCoverage(r, surfaces, () => true),
    { routes: 1, covered: 0, readOnly: 0, reviewRequired: 1, background: 1, inventoryOnly: true },
  );
});
