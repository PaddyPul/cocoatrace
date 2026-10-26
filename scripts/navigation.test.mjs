import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  navigation,
  resolveWorkspace,
  workspaces,
  activeNavigation,
} from '../web/src/navigation/model.ts';
import { navigationEnglish, navigationFrench } from '../web/src/navigation/catalogs.ts';
const buyer = {
  orgType: 'importer',
  permissions: [
    'listing.read',
    'offer.create',
    'contract.read',
    'payment.read',
    'evidence.read',
    'batch.read',
  ],
};
const supplier = {
  orgType: 'exporter',
  permissions: [
    'listing.read',
    'listing.create',
    'offer.respond',
    'contract.read',
    'holding.read',
    'farm.read',
    'batch.read',
    'evidence.read',
  ],
};
const ids = (menu) => menu.groups.flatMap((group) => group.items.map((item) => item.id));
test('single-role accounts reject stored or requested workspaces they are not granted', () => {
  assert.deepEqual(workspaces(buyer), ['buy']);
  assert.deepEqual(workspaces(supplier), ['sell']);
  assert.equal(resolveWorkspace(buyer, 'sell'), 'buy');
  assert.equal(resolveWorkspace(supplier, 'admin'), 'sell');
  assert.ok(!ids(navigation(buyer, 'admin')).includes('access-controls'));
});
test('buyer and supplier menus expose their own tasks and preserve readable records', () => {
  const b = navigation(buyer, 'buy'),
    s = navigation(supplier, 'sell');
  assert.ok(ids(b).includes('sourcing-requests'));
  assert.ok(!ids(b).includes('holdings'));
  assert.ok(ids(s).includes('holdings') && ids(s).includes('farms'));
  assert.ok(!ids(s).includes('sourcing-requests'));
  assert.equal(b.create.path, '/source/new');
  assert.equal(s.create.path, '/supply/new');
  assert.ok(b.utility.some((item) => item.id === 'recalls'));
  assert.ok(s.utility.some((item) => item.id === 'notifications'));
});
test('platform administration is distinct while explicit permitted trading preferences still work', () => {
  const admin = { orgType: 'regulator', permissions: ['*'] };
  assert.equal(resolveWorkspace(admin, null), 'admin');
  assert.equal(resolveWorkspace(admin, 'sell'), 'sell');
  const menu = navigation(admin, 'admin');
  assert.ok(ids(menu).includes('access-applications'));
  assert.ok(ids(menu).includes('operations'));
  assert.ok(!ids(menu).includes('my-listings'));
});
test('read and write capabilities are not interchangeable for record navigation', () => {
  const uploadOnly = {
    orgType: 'exporter',
    permissions: ['evidence.upload', 'shipment.update', 'farm.create'],
  };
  const menu = navigation(uploadOnly, 'records');
  assert.ok(!ids(menu).includes('evidence'));
  assert.ok(!ids(menu).includes('shipments'));
  assert.ok(!ids(menu).includes('farms'));
});
test('child pages preserve the correct navigation parent and catalogs remain aligned', () => {
  assert.equal(activeNavigation('contracts', 'deal-room'), true);
  assert.equal(activeNavigation('contracts', 'contract'), true);
  assert.equal(activeNavigation('batches', 'batch'), true);
  assert.equal(activeNavigation('sourcing-requests', 'source-new'), true);
  assert.deepEqual(Object.keys(navigationEnglish).sort(), Object.keys(navigationFrench).sort());
  assert.ok(Object.values(navigationFrench).every((value) => value.trim()));
});

test('daily destinations stay in one primary group and supporting destinations are grouped', () => {
  const admin = { orgType: 'regulator', permissions: ['*'] };
  const menus = [
    navigation(buyer, 'buy'),
    navigation(supplier, 'sell'),
    navigation(admin, 'admin'),
  ];
  assert.deepEqual(
    menus[0].groups[0].items.map((item) => item.id),
    ['home', 'sourcing-requests', 'marketplace', 'offers', 'contracts'],
  );
  assert.deepEqual(
    menus[1].groups[0].items.map((item) => item.id),
    ['home', 'my-listings', 'offers', 'contracts'],
  );
  assert.deepEqual(
    menus[2].groups[0].items.map((item) => item.id),
    ['home', 'access-applications', 'platform-fees', 'operations'],
  );
  for (const menu of menus) {
    assert.ok(menu.groups.some((group) => group.id === 'account'));
    assert.equal(menu.groups[0].collapsible, undefined);
    assert.ok(menu.groups.slice(1).every((group) => group.collapsible));
    const all = ids(menu);
    assert.equal(new Set(all).size, all.length);
  }
  assert.ok(menus[0].groups[1].items.some((item) => item.id === 'payments'));
  assert.ok(menus[2].groups[1].items.some((item) => item.id === 'access-controls'));
  assert.equal(menus[2].create, null);
});

for (const [name, actor, mode] of [
  ['buyer', buyer, 'buy'],
  ['supplier', supplier, 'sell'],
]) {
  test(`${name}: team access belongs to organization admins and stays hidden from ordinary members`, () => {
    const member = navigation(actor, mode);
    assert.ok(!ids(member).includes('pilot'));
    for (const permission of ['member.invite', 'member.manage']) {
      const admin = navigation({ ...actor, permissions: [...actor.permissions, permission] }, mode);
      assert.ok(
        admin.groups
          .find((group) => group.id === 'organization')
          .items.some((item) => item.id === 'pilot'),
      );
    }
    assert.ok(
      member.groups
        .find((group) => group.id === 'account')
        .items.some((item) => item.id === 'account-security'),
    );
  });
}
test('buyer source permissions retain contextual access without supplier register menu entries', () => {
  const b = navigation({ ...buyer, permissions: [...buyer.permissions, 'farm.read'] }, 'buy');
  assert.ok(!ids(b).includes('farms') && !ids(b).includes('batches'));
  assert.ok(ids(b).includes('products'));
  const supplierAdmin = navigation(
    { ...supplier, permissions: [...supplier.permissions, 'member.manage'] },
    'sell',
  );
  assert.ok(ids(supplierAdmin).includes('farms') && ids(supplierAdmin).includes('batches'));
  const platformBuyer = navigation({ orgType: 'regulator', permissions: ['*'] }, 'buy');
  assert.ok(!ids(platformBuyer).includes('farms') && !ids(platformBuyer).includes('batches'));
  const a = navigation({ orgType: 'regulator', permissions: ['*'] }, 'admin');
  for (const id of ['evidence-review', 'evidence', 'contracts', 'payments', 'shipments', 'pilot'])
    assert.ok(ids(a).includes(id));
});

test('every registered route has an explicit menu, contextual, public, demo or redirect entry', () => {
  const source = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8');
  const routes = [...source.matchAll(/path="([^"]+)"/g)].map((match) => match[1]);
  const coverage = JSON.parse(
    readFileSync(
      new URL('../docs/quality/navigation-route-coverage.json', import.meta.url),
      'utf8',
    ),
  ).routes;
  assert.deepEqual(coverage.map((row) => row.path).sort(), routes.sort());
  const actor = { orgType: 'regulator', permissions: ['*'] };
  const menuPaths = new Set(
    ['admin', 'buy', 'sell'].flatMap((mode) => {
      const menu = navigation(actor, mode);
      return [
        ...menu.groups.flatMap((group) => group.items),
        ...menu.utility,
        ...(menu.create ? [menu.create] : []),
      ].map((item) => item.path.split('?')[0]);
    }),
  );
  for (const row of coverage) {
    if (row.entry === 'menu') assert.ok(menuPaths.has(row.path), `Missing menu entry: ${row.path}`);
    else if (row.entry === 'contextual')
      assert.ok(menuPaths.has(row.parent), `Missing parent entry: ${row.path}`);
    else assert.ok(['public-or-token', 'demo-only', 'redirect'].includes(row.entry));
  }
});
