import { english, french } from './catalogs';

export type Language = 'en' | 'fr';
export const localeFor = (language: Language) => (language === 'fr' ? 'fr-FR' : 'en-GB');
export const normalizeLanguage = (value: unknown): Language => (value === 'fr' ? 'fr' : 'en');
export const preferenceKey = (userId?: string) => `ct_language_v1:${userId || 'guest'}`;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

export function readLanguage(storage: StorageAccess | undefined, userId?: string): Language {
  try {
    return normalizeLanguage(storage?.getItem(preferenceKey(userId)));
  } catch {
    return 'en';
  }
}
export function saveLanguage(
  storage: StorageAccess | undefined,
  userId: string | undefined,
  language: Language,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(preferenceKey(userId), language);
    return true;
  } catch {
    return false;
  }
}

export function translate(language: Language, key: string, fallback = key): string {
  if (!Object.prototype.hasOwnProperty.call(english, key)) return fallback;
  const en = english[key as keyof typeof english];
  const translated = language === 'fr' ? french[key as keyof typeof english] : en;
  return translated || en || fallback;
}

// Display only. Never parse localized output back into commercial amounts,
// determine payment gates, or infer an exchange rate or settlement precision.
export function formatAmount(
  value: number | string,
  currency: string,
  minorUnits: 0 | 2,
  language: Language,
): string {
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value))
    throw new Error('Expected canonical display amount');
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Invalid display amount');
  return `${currency} ${new Intl.NumberFormat(localeFor(language), {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amount)}`;
}
export function formatQuantity(value: number, language: Language): string {
  if (!Number.isFinite(value)) throw new Error('Invalid display quantity');
  return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 3 }).format(value);
}
export function formatCalendarDate(isoDate: string, language: Language): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error('Expected ISO calendar date');
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate)
    throw new Error('Invalid calendar date');
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
