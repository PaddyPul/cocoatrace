import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { readWorkspaceEnvironment, type WorkspaceEnvironment } from './environment';

export default function EnvironmentNotice() {
  const { t } = useLanguage();
  const [environment, setEnvironment] = useState<WorkspaceEnvironment>('unknown');
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const timer = window.setTimeout(() => controller.abort(), 5000);
    void readWorkspaceEnvironment(fetch, controller.signal)
      .then((value) => {
        if (mounted) setEnvironment(value);
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <aside
      role="note"
      aria-label={t('environment.label')}
      className={`border-b px-4 py-2 text-center text-xs ${environment === 'production' ? 'border-border bg-surface text-text-muted' : environment === 'staging' ? 'border-blue-300 bg-blue-50 text-blue-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}
    >
      {t(`environment.${environment}`)}
    </aside>
  );
}
