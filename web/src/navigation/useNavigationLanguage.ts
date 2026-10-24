import { useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { navigationEnglish, navigationFrench } from './catalogs';

// Keep workspace-only copy out of the public entry download budget.
export function useNavigationLanguage() {
  const base = useLanguage();
  const t = useCallback(
    (key: string, fallback?: string) => {
      if (Object.prototype.hasOwnProperty.call(navigationEnglish, key)) {
        const catalog = base.language === 'fr' ? navigationFrench : navigationEnglish;
        return catalog[key as keyof typeof navigationEnglish];
      }
      return base.t(key, fallback);
    },
    [base.language, base.t],
  );
  return { ...base, t };
}
