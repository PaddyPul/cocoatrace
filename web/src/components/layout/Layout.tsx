import { containDialogTab } from '../shared/dialogKeyboard';
import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import Sidebar, { navigationIcons } from './Sidebar';
import { navigation } from '../../navigation/model';
import { useWorkspace } from '../../navigation/useWorkspace';
import { offers } from '../../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { supportLink } from '../../domains/support/context';
import { Bell, LifeBuoy, Menu, Search, Sparkles, X } from 'lucide-react';
import PilotFeedback from '../shared/PilotFeedback';
import { LanguageSelector } from '../../i18n/LanguageProvider';
import { useNavigationLanguage as useLanguage } from '../../navigation/useNavigationLanguage';
import { webConfig } from '../../config';

export default function Layout({
  children,
  currentPage,
  actions,
}: {
  children: ReactNode;
  currentPage: string;
  actions?: ReactNode;
}) {
  const { user } = useAuthCtx();
  const { t } = useLanguage();
  const { mode } = useWorkspace();
  const badgeKey = `${user?.id}:${user?.organizationId}:${mode}:${user?.permissions.join(',')}`;
  const [offerBadge, setOfferBadge] = useState<{ key: string; count: number | null }>({
    key: '',
    count: null,
  });
  const offerCount = offerBadge.key === badgeKey ? offerBadge.count : null;
  useEffect(() => {
    if (
      !user ||
      !['buy', 'sell'].includes(mode) ||
      !user.permissions.some((p) => ['*', 'offer.create', 'offer.respond'].includes(p))
    )
      return;
    let active = true;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      setOfferBadge({ key: badgeKey, count: null });
      try {
        const summary = await offers.summary();
        const fields = [
          summary?.received_count,
          summary?.sent_count,
          summary?.received_pending,
          summary?.sent_pending,
        ];
        if (
          !fields.every((value) => Number.isSafeInteger(value) && value >= 0) ||
          summary.received_pending > summary.received_count ||
          summary.sent_pending > summary.sent_count
        )
          throw new Error('Invalid offer count');
        if (active && request === sequence)
          setOfferBadge({
            key: badgeKey,
            count: mode === 'buy' ? summary.sent_pending : summary.received_pending,
          });
      } catch {
        if (active && request === sequence) setOfferBadge({ key: badgeKey, count: null });
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void load();
    }, 15000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [badgeKey, mode]);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const commandDialog = useRef<HTMLDialogElement>(null);
  const commandReturnFocus = useRef<HTMLElement | null>(null);
  const navigationReturnFocus = useRef<HTMLElement | null>(null);
  const navigationDialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (!commandOpen) return;
    const element = commandDialog.current;
    const trigger = commandReturnFocus.current;
    element?.showModal();
    return () => {
      element?.close();
      queueMicrotask(() => {
        if (
          trigger?.isConnected &&
          trigger.getClientRects().length &&
          !document.querySelector('dialog[open]')
        )
          trigger.focus();
      });
    };
  }, [commandOpen]);
  useLayoutEffect(() => {
    if (!sidebarOpen) return;
    const element = navigationDialog.current;
    const trigger = navigationReturnFocus.current;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (desktop.matches) setSidebarOpen(false);
    };
    desktop.addEventListener('change', resize);
    element?.showModal();
    resize();
    return () => {
      desktop.removeEventListener('change', resize);
      element?.close();
      queueMicrotask(() => {
        if (
          trigger?.isConnected &&
          trigger.getClientRects().length &&
          !document.querySelector('dialog[open]')
        )
          trigger.focus();
      });
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => {
          if (!open && document.activeElement instanceof HTMLElement)
            commandReturnFocus.current = document.activeElement;
          return !open;
        });
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const commandItems = useMemo(() => {
    const menu = navigation(user, mode);
    const items = [
      ...(menu.create ? [menu.create] : []),
      ...menu.groups.flatMap((group) => group.items),
      ...menu.utility,
    ].map((item) => ({
      label: t(item.label),
      hint: t('nav.navigation'),
      path: item.path,
      icon: navigationIcons[item.icon] || Search,
    }));
    if (webConfig.demoMode)
      items.push({
        label: t('command.demo.label'),
        hint: t('command.demo.hint'),
        path: '/demo',
        icon: Sparkles,
      });
    return items.filter(
      (item) =>
        !commandSearch ||
        `${item.label} ${item.hint}`.toLowerCase().includes(commandSearch.toLowerCase()),
    );
  }, [commandSearch, user, mode, t]);

  const chooseCommand = (path: string) => {
    setCommandOpen(false);
    setCommandSearch('');
    navigate(path);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-surface-darker">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-surface focus:p-3"
      >
        Skip to main content
      </a>
      <div className="hidden lg:flex">
        <Sidebar
          offerCount={offerCount}
          currentPage={currentPage}
          onNavigate={() => setSidebarOpen(false)}
          className="w-[272px] border-r border-white/10"
        />
      </div>
      {sidebarOpen && (
        <dialog
          onKeyDown={containDialogTab}
          ref={navigationDialog}
          aria-label={t('shell.openNav')}
          className="m-0 h-dvh max-h-none w-[272px] max-w-[90vw] border-0 p-0 backdrop:bg-black/50 lg:hidden"
          onCancel={(event) => {
            event.preventDefault();
            setSidebarOpen(false);
          }}
        >
          <Sidebar
            offerCount={offerCount}
            currentPage={currentPage}
            onNavigate={() => setSidebarOpen(false)}
            className="h-full"
          />
        </dialog>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="min-h-20 bg-surface-dark/95 backdrop-blur border-b border-border flex items-center px-4 sm:px-7 gap-4 shrink-0">
          <button
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-border text-text-secondary hover:bg-surface-light hover:text-text-primary"
            onClick={(event) => {
              navigationReturnFocus.current = event.currentTarget;
              setSidebarOpen(true);
            }}
            aria-label={t('shell.openNav')}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
              {t(`title.${currentPage}`, currentPage)}
            </h1>
            <p className="mt-0.5 hidden truncate text-[11px] text-text-muted sm:block">
              {t(`description.${currentPage}`, '')}
            </p>
          </div>
          <LanguageSelector />
          <button
            className="btn btn-sm"
            aria-label={t('shell.notifications')}
            onClick={() => navigate('/notifications')}
          >
            <Bell size={16} />
          </button>
          <button
            className="btn btn-sm"
            aria-label={t('shell.reportIssue')}
            title={t('shell.reportIssue')}
            onClick={() => navigate(supportLink(currentPage, location.pathname))}
          >
            <LifeBuoy size={16} />
          </button>
          <div className="flex items-center gap-2">{actions}</div>
          <button
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[11px] text-text-muted transition hover:border-brand-400/30 hover:text-text-primary md:flex"
            onClick={(event) => {
              commandReturnFocus.current = event.currentTarget;
              setCommandOpen(true);
            }}
          >
            <Search size={14} /> {t('shell.find')}{' '}
            <kbd className="ml-3 rounded border border-border bg-surface-darker px-1.5 py-0.5 font-mono text-[9px]">
              ⌘K
            </kbd>
          </button>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(109,190,90,.6)]" />
            <div className="max-w-36 leading-tight">
              <div className="truncate text-[11px] font-semibold text-text-primary">
                {user?.orgName}
              </div>
              <div className="truncate text-[9px] uppercase tracking-wider text-text-muted">
                {t(`workspace.${mode}`)}
              </div>
            </div>
          </div>
        </header>

        <main id="workspace-main" tabIndex={-1} lang="en" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {commandOpen && (
        <dialog
          onKeyDown={containDialogTab}
          ref={commandDialog}
          aria-label={t('shell.find')}
          className="mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl border border-border bg-surface-dark p-0 text-white shadow-2xl shadow-black/50 backdrop:bg-black/70"
          onCancel={(event) => {
            event.preventDefault();
            setCommandOpen(false);
          }}
        >
          <div className="flex items-center gap-3 border-b border-border px-5">
            <Search size={18} className="text-brand-400" />
            <input
              autoFocus
              aria-label={t('shell.find')}
              className="min-h-16 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-text-muted"
              placeholder={t('shell.searchPlaceholder')}
              value={commandSearch}
              onChange={(event) => setCommandSearch(event.target.value)}
            />
            <button
              aria-label="Close workflow search"
              className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white"
              onClick={() => setCommandOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto p-2">
            {commandItems.length ? (
              commandItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => chooseCommand(item.path)}
                    className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-white/[.05]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/10 text-brand-400">
                      <Icon size={17} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] text-text-muted">{item.hint}</span>
                    </span>
                    <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100">
                      {t('shell.open')}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-10 text-center text-xs text-text-muted">{t('shell.noMatch')}</div>
            )}
          </div>
          <div className="border-t border-border px-5 py-3 text-[9px] text-text-muted">
            {t('shell.searchHint')}
          </div>
        </dialog>
      )}
      <PilotFeedback currentPage={currentPage} />
    </div>
  );
}
