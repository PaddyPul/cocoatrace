export type FilterScope = 'marketplace' | 'inventory' | 'offers';
export type FilterValues = Record<string, string>;
export type SavedFilter = { id: string; name: string; values: FilterValues };
export interface FilterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const scopes: FilterScope[] = ['marketplace', 'inventory', 'offers'];
const safeText = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  !Array.from(value).some((character) => character.charCodeAt(0) < 32) &&
  !/:\/\/|www\.|@/i.test(value);
export function validateValues(scope: FilterScope, values: unknown): values is FilterValues {
  if (!scopes.includes(scope) || !values || typeof values !== 'object' || Array.isArray(values))
    return false;
  const rules: Record<string, (value: unknown) => boolean> = {
    search: (value) => safeText(value, 80),
  };
  if (scope === 'marketplace')
    Object.assign(rules, {
      origin: (v: unknown) => safeText(v, 80),
      minimum: (v: unknown) => typeof v === 'string' && /^(?:\d{1,12}(?:\.\d{1,3})?)?$/.test(v),
      organic: (v: unknown) => v === 'true' || v === 'false',
      currency: (v: unknown) => ['', 'EUR', 'USD', 'GHS', 'GBP', 'JPY'].includes(v as string),
      sort: (v: unknown) => ['match', 'price', 'quantity'].includes(v as string),
    });
  if (scope === 'offers') rules.direction = (value) => value === 'sent' || value === 'received';
  return (
    Object.entries(values).every(
      ([key, value]) => Object.prototype.hasOwnProperty.call(rules, key) && rules[key](value),
    ) && typeof (values as FilterValues).search === 'string'
  );
}
export function storageKey(account: string, organization: string, scope: FilterScope) {
  if (!account || !organization || !scopes.includes(scope))
    throw new Error('An account and organization are required.');
  return `ct_saved_filters:v1:${encodeURIComponent(account)}:${encodeURIComponent(organization)}:${scope}`;
}
export function readFilters(
  storage: FilterStorage,
  key: string,
  scope: FilterScope,
): SavedFilter[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 16384) throw new Error('Saved filter storage exceeds the supported limit');
  if (raw.length > 100_000) throw new Error('Saved filters exceed storage limit');
  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    !value.every(
      (item) =>
        item &&
        Object.keys(item).sort().join(',') === 'id,name,values' &&
        typeof item.id === 'string' &&
        /^[a-zA-Z0-9-]{16,80}$/.test(item.id) &&
        safeText(item.name, 50) &&
        item.name.trim() &&
        validateValues(scope, item.values),
    ) ||
    new Set(value.map((item) => item.id)).size !== value.length
  )
    throw new Error('Invalid saved filters');
  return value;
}
export function createFilter(
  scope: FilterScope,
  name: string,
  values: FilterValues,
  id: string,
): SavedFilter {
  const filter = { id, name: name.trim(), values: { ...values } };
  const memory = { getItem: () => JSON.stringify([filter]), setItem: () => {} };
  readFilters(memory, '', scope);
  return filter;
}
export function writeFilters(
  storage: FilterStorage,
  key: string,
  scope: FilterScope,
  filters: SavedFilter[],
) {
  readFilters({ getItem: () => JSON.stringify(filters), setItem: () => {} }, '', scope);
  // Refuse to overwrite bytes that cannot be read and validated.
  readFilters(storage, key, scope);
  storage.setItem(key, JSON.stringify(filters));
}
