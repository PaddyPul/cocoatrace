import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { Language, normalizeLanguage, readLanguage, saveLanguage, translate } from './locale';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  saved: boolean;
  t: (key: string, fallback?: string) => string;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Remount on account changes: a previous user's session preference never becomes
// the next account's default, including when browser storage is unavailable.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthCtx();
  return (
    <AccountLanguage key={user?.id || 'guest'} userId={user?.id}>
      {children}
    </AccountLanguage>
  );
}
function AccountLanguage({ children, userId }: { children: ReactNode; userId?: string }) {
  const [language, updateLanguage] = useState<Language>(() =>
    readLanguage(browserStorage(), userId),
  );
  const [saved, setSaved] = useState(true);
  const t = useCallback(
    (key: string, fallback?: string) => translate(language, key, fallback),
    [language],
  );
  const setLanguage = (value: Language) => {
    const next = normalizeLanguage(value);
    updateLanguage(next);
    setSaved(saveLanguage(browserStorage(), userId, next));
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage, saved, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required');
  return context;
}
export function LanguageSelector() {
  const { language, setLanguage, saved, t } = useLanguage();
  return (
    <div className="max-w-48 text-xs">
      <label className="flex flex-wrap items-center gap-1">
        <span>{t('shell.language')}</span>
        <select
          className="rounded-lg border border-border bg-surface px-2 py-2"
          title={t('shell.device')}
          value={language}
          onChange={(event) => setLanguage(normalizeLanguage(event.target.value))}
        >
          <option value="en" lang="en">
            English
          </option>
          <option value="fr" lang="fr">
            Français
          </option>
        </select>
      </label>
      <p className="mt-1 text-[10px] text-text-muted">{t('shell.scope')}</p>
      {!saved && (
        <p role="status" className="mt-1 text-amber-300">
          {t('shell.storage')}
        </p>
      )}
    </div>
  );
}
