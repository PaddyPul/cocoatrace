import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  discoverRoutes,
  extractRoutes,
  repositoryRoot,
  validateRegister,
} from './authorization-register.mjs';
const fixture = (source) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-auth-routes-'));
  fs.mkdirSync(path.join(root, 'api/src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/src/app.ts'), source);
  return { root, close: () => fs.rmSync(root, { recursive: true, force: true }) };
};
test('extracts ordered prefix/route guards and literal OR permissions without granting sibling scope', () => {
  const rows = extractRoutes(
    `const router=Router();
    router.use('/admin',requireAuth,requirePermission('*'));
    router.get('/admin/items',handler);
    router.get('/administrator',requireAuth,requireAnyPermission('batch.read','farm.read'),handler);
    router.post('/later',requireAuth,handler);
    router.use('/later',requirePermission('*'));`,
    'api/src/routes/fixture.ts',
  );
  assert.deepEqual(rows[0].guards, [{ kind: 'session' }, { kind: 'all', permissions: ['*'] }]);
  assert.deepEqual(rows[1].guards, [
    { kind: 'session' },
    { kind: 'any', permissions: ['batch.read', 'farm.read'] },
  ]);
  assert.deepEqual(rows[2].guards, [{ kind: 'session' }]);
});
test('rejects unsupported dynamic and alternative router declarations instead of omitting them', () => {
  for (const source of [
    `const router=Router();router.get(dynamic,handler);`,
    `const other=Router();other.get('/oops',handler);`,
    `const router=Router();router['get']('/oops',handler);`,
    `const router=Router();router.route('/oops').get(handler);`,
  ])
    assert.throws(() => extractRoutes(source, 'api/src/routes/fixture.ts'));
});
test('unreviewed anonymous entry points fail discovery', () => {
  const file = fixture(`app.post('/new-public',handler);`);
  try {
    assert.throws(() => discoverRoutes(file.root), /Unreviewed anonymous/);
  } finally {
    file.close();
  }
});
test('duplicate routes and permission-before-authentication drift fail discovery', () => {
  for (const source of [
    `app.get('/same',requireAuth,handler);app.get('/same',requireAuth,handler);`,
    `app.get('/private',requirePermission('*'),requireAuth,handler);`,
  ]) {
    const file = fixture(source);
    try {
      assert.throws(() => discoverRoutes(file.root));
    } finally {
      file.close();
    }
  }
});
test('upload capability cannot lose its capability-aware body handler', () => {
  const file = fixture(`app.put('/evidence/upload-intents/:id/content',unprotectedHandler);`);
  try {
    assert.throws(() => discoverRoutes(file.root), /capability-aware/);
  } finally {
    file.close();
  }
});
test('live source matches the reviewed register and existing resource-policy evidence', () => {
  const register = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'docs/security/route-authorization.json'), 'utf8'),
  );
  const actual = discoverRoutes();
  validateRegister(register, actual);
  assert.ok(actual.length > 150);
  assert.ok(actual.some((row) => row.source === 'api/src/modules/organizationAccess/routes.ts'));
  const changed = structuredClone(register);
  changed.routes[0].handler = 'unreviewedHandler';
  assert.throws(() => validateRegister(changed, actual), /differs from source/);
  const orphan = structuredClone(register);
  orphan.policies['api/src/app.ts'].evidence = ['api/missing-policy.ts'];
  assert.throws(() => validateRegister(orphan, actual), /Missing policy/);
});
