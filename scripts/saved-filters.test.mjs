import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storageKey,
  createFilter,
  readFilters,
  writeFilters,
  validateValues,
} from '../web/src/domains/savedFilters/storage.ts';
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const preset = (id = '12345678-1234-1234-1234-123456789abc') =>
  createFilter('inventory', 'Cocoa', { search: 'cocoa' }, id);
test('save, reload, apply values and delete without sharing accounts, organizations or scopes', () => {
  const store = memory();
  const key = storageKey('a', 'org', 'inventory');
  writeFilters(store, key, 'inventory', [preset()]);
  assert.deepEqual(readFilters(store, key, 'inventory')[0].values, { search: 'cocoa' });
  for (const other of [
    storageKey('b', 'org', 'inventory'),
    storageKey('a', 'other', 'inventory'),
    storageKey('a', 'org', 'offers'),
  ])
    assert.deepEqual(readFilters(store, other, 'inventory'), []);
  writeFilters(store, key, 'inventory', []);
  assert.deepEqual(readFilters(store, key, 'inventory'), []);
  assert.notEqual(storageKey('a:b', 'c', 'inventory'), storageKey('a', 'b:c', 'inventory'));
});
test('malformed stored bytes are preserved on write', () => {
  for (const raw of [
    ' '.repeat(16385),
    '{bad',
    'null',
    '{}',
    JSON.stringify([{ ...preset(), values: { search: 'ok', url: 'https://example.test' } }]),
    JSON.stringify([preset(), preset()]),
  ]) {
    const store = memory();
    store.setItem('key', raw);
    assert.throws(() => readFilters(store, 'key', 'inventory'));
    assert.throws(() => writeFilters(store, 'key', 'inventory', []));
    assert.equal(store.getItem('key'), raw);
  }
});
test('blocked storage errors remain explicit to caller', () => {
  const store = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.throws(() => readFilters(store, 'key', 'inventory'), /blocked/);
  assert.throws(() => writeFilters(store, 'key', 'inventory', [preset()]), /blocked/);
  const quota = {
    getItem: () => null,
    setItem() {
      throw new Error('quota');
    },
  };
  assert.throws(() => writeFilters(quota, 'key', 'inventory', [preset()]), /quota/);
});
test('bounded names, searches, count, opaque IDs and scope whitelist', () => {
  assert.throws(() => createFilter('inventory', 'a'.repeat(51), { search: '' }, preset().id));
  for (const search of [
    'a'.repeat(81),
    'https://example.test',
    'www.example.test',
    'name@example.test',
    'a\nb',
  ])
    assert.equal(validateValues('inventory', { search }), false);
  for (const values of [
    { search: '', status: 'active' },
    { search: '', payload: {} },
    { search: '', direction: 'sent' },
  ])
    assert.equal(validateValues('inventory', values), false);
  assert.equal(
    validateValues('marketplace', {
      search: '',
      organic: 'true',
      sort: 'price',
      currency: 'USD',
      minimum: '1000',
      origin: 'Ghana',
    }),
    true,
  );
  assert.equal(validateValues('offers', { search: '', direction: 'sent' }), true);
  assert.equal(validateValues('unknown', { search: '' }), false);
  assert.throws(() => createFilter('inventory', 'valid', { search: '' }, 'username'));
  const store = memory();
  const filters = Array.from({ length: 11 }, (_, i) =>
    preset(`12345678-1234-1234-1234-${String(i).padStart(12, '0')}`),
  );
  assert.throws(() => writeFilters(store, 'key', 'inventory', filters));
});

test('stored filter keys are order-independent and reject an additional property', () => {
  const item = preset();
  const key = storageKey('user', 'org', 'inventory');
  for (const record of [
    { values: item.values, name: item.name, id: item.id },
    { name: item.name, id: item.id, values: item.values },
  ]) {
    const store = memory();
    store.setItem(key, JSON.stringify([record]));
    assert.deepEqual(readFilters(store, key, 'inventory'), [item]);
    store.setItem(key, JSON.stringify([{ ...record, unexpected: true }]));
    assert.throws(() => readFilters(store, key, 'inventory'));
  }
});
