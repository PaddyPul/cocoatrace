import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkBrandingInventory, checkRepositoryBranding } from './check-branding.mjs';
const inventory = {
  version: 1,
  customerBrand: 'BetterTrade',
  anchors: [
    {
      id: 'cookie',
      path: 'session.ts',
      includes: ['ct_session'],
      reason: 'Existing cookie sessions',
    },
    {
      id: 'volume',
      path: 'compose.yml',
      includes: ['cocoatrace_pgdata'],
      reason: 'Existing stored inventory',
    },
  ],
};
const fixture = {
  'session.ts': "cookie('ct_session')",
  'compose.yml': 'volume: cocoatrace_pgdata',
  'web/index.html': '<title>BetterTrade — Trade',
  'web/src/title.tsx': '<h1>BetterTrade</h1>',
};
const read = (file) => {
  if (!(file in fixture)) throw new Error('Missing source');
  return fixture[file];
};
test('display rename preserves the established session and persistent data identity', () => {
  assert.equal(
    checkBrandingInventory(inventory, read, ['web/index.html', 'web/src/title.tsx']).status,
    'passed',
  );
});
test('renaming a persistent volume or cookie cannot silently pass as a display change', () => {
  for (const file of ['session.ts', 'compose.yml']) {
    const changed = (name) =>
      name === file
        ? read(name)
            .replaceAll('ct_session', 'bt_session')
            .replaceAll('cocoatrace_pgdata', 'bettertrade_pgdata')
        : read(name);
    assert.throws(
      () => checkBrandingInventory(inventory, changed, []),
      /Compatibility anchor changed/,
    );
  }
});
test('old customer copy fails while historical internal namespaces remain permitted', () => {
  assert.throws(
    () =>
      checkBrandingInventory(
        inventory,
        (file) => (file === 'web/src/title.tsx' ? '<h1>CocoaTrace</h1>' : read(file)),
        ['web/src/title.tsx'],
      ),
    /Legacy display brand/,
  );
  assert.equal(checkBrandingInventory(inventory, read, ['web/index.html']).status, 'passed');
});
test('invalid inventory, missing sources and path traversal fail closed', () => {
  for (const value of [
    null,
    { ...inventory, version: 2 },
    { ...inventory, anchors: [...inventory.anchors, inventory.anchors[0]] },
    { ...inventory, anchors: [{ ...inventory.anchors[0], path: '../secret' }] },
  ])
    assert.throws(() => checkBrandingInventory(value, read, []));
  assert.throws(
    () =>
      checkBrandingInventory(
        { ...inventory, anchors: [{ ...inventory.anchors[0], path: 'missing.ts' }] },
        read,
        [],
      ),
    /Missing source/,
  );
});
test('the reviewed repository inventory and customer identity are current', () => {
  assert.equal(
    checkRepositoryBranding(fileURLToPath(new URL('../', import.meta.url))).status,
    'passed',
  );
});
