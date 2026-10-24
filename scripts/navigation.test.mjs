import test from 'node:test';
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
