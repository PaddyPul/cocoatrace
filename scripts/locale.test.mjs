import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { english, french } from '../web/src/i18n/catalogs.ts';
import {
  normalizeLanguage,
  preferenceKey,
  readLanguage,
  saveLanguage,
  translate,
  formatAmount,
  formatQuantity,
  formatCalendarDate,
} from '../web/src/i18n/locale.ts';

test('both shell catalogs cover the same stable keys without empty translations', () => {
  assert.deepEqual(Object.keys(french).sort(), Object.keys(english).sort());
  for (const key of Object.keys(english)) {
    assert.ok(english[key].trim());
    assert.ok(french[key].trim());
  }
  assert.equal(translate('fr', 'nav.contracts'), 'Commandes et transactions');
  assert.equal(translate('fr', 'future.key', 'English fallback'), 'English fallback');
  assert.equal(translate('fr', 'constructor', 'English fallback'), 'English fallback');
  assert.equal(translate('fr', '__proto__', 'English fallback'), 'English fallback');
});
test('invalid or inaccessible preference defaults safely to English', () => {
  for (const value of ['de', 'FR', null, '<script>', ''])
    assert.equal(normalizeLanguage(value), 'en');
  const denied = {
    getItem() {
      throw new Error('Denied');
    },
    setItem() {
      throw new Error('Denied');
    },
  };
  assert.equal(readLanguage(denied, 'user'), 'en');
  assert.equal(saveLanguage(denied, 'user', 'fr'), false);
  assert.equal(saveLanguage(undefined, 'user', 'fr'), false);
});
test('device preferences are separated by account and anonymous browsing', () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  assert.ok(saveLanguage(storage, 'alice', 'fr'));
  assert.equal(readLanguage(storage, 'alice'), 'fr');
  assert.equal(readLanguage(storage, 'bob'), 'en');
  assert.equal(readLanguage(storage), 'en');
  assert.notEqual(preferenceKey('alice'), preferenceKey('bob'));
});
test('locale changes separators while retaining currency and historical settlement precision', () => {
  assert.equal(formatAmount('1234.50', 'EUR', 2, 'en'), 'EUR 1,234.50');
  assert.equal(formatAmount('1234.50', 'EUR', 2, 'fr'), 'EUR 1\u202f234,50');
  assert.equal(formatAmount('51.00', 'JPY', 0, 'fr'), 'JPY 51');
  assert.equal(formatAmount('50.50', 'JPY', 2, 'fr'), 'JPY 50,50');
  assert.equal(formatQuantity(1234.125, 'fr'), '1\u202f234,125');
  assert.throws(() => formatAmount('bad', 'EUR', 2, 'en'));
});
test('calendar dates cannot shift time zones or accept ambiguous input', () => {
  assert.equal(formatCalendarDate('2026-10-06', 'en'), '6 Oct 2026');
  assert.equal(formatCalendarDate('2026-10-06', 'fr'), '6 oct. 2026');
  for (const date of ['06/10/2026', '2026-02-30', '2026-10-06T23:00:00Z'])
    assert.throws(() => formatCalendarDate(date, 'fr'));
});

// Catch a newly added selector/nav label missing from both catalogs.
test('every literal workspace translation key is registered', () => {
  for (const file of [
    '../web/src/components/layout/Layout.tsx',
    '../web/src/components/layout/Sidebar.tsx',
    '../web/src/i18n/LanguageProvider.tsx',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g))
      assert.ok(Object.hasOwn(english, match[1]), `Missing catalog key: ${match[1]}`);
  }
});
