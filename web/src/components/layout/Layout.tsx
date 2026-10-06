import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';
import { Boxes, FileText, GitBranch, Home, LayoutDashboard, Menu, QrCode, Search, Ship, ShoppingBag, Sparkles, Trees, X } from 'lucide-react';
import PilotFeedback from '../shared/PilotFeedback';
import { useLanguage, LanguageSelector } from '../../i18n/LanguageProvider';
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen((open) => !open); }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const commandItems = useMemo(() => [
    { label: t('command.home.label'), hint: t('command.home.hint'), path: '/home', icon: Home, permissions: [] },
    { label: t('command.source.label'), hint: t('command.source.hint'), path: '/source/new', icon: Search, permissions: ['offer.create'] },
    { label: t('command.publish.label'), hint: t('command.publish.hint'), path: '/supply/new', icon: ShoppingBag, permissions: ['listing.create'] },
    { label: t('command.controlTower.label'), hint: t('command.controlTower.hint'), path: '/dashboard', icon: LayoutDashboard, permissions: [] },
    ...(webConfig.demoMode ? [{ label: t('command.demo.label'), hint: t('command.demo.hint'), path: '/demo', icon: Sparkles, permissions: [] }] : []),
    { label: t('command.products.label'), hint: t('command.products.hint'), path: '/products', icon: QrCode, permissions: ['batch.read'] },
    { label: t('command.recalls.label'), hint: t('command.recalls.hint'), path: '/recalls', icon: GitBranch, permissions: ['batch.read', 'recall.manage'] },
    { label: t('command.batches.label'), hint: t('command.batches.hint'), path: '/batches', icon: Boxes, permissions: ['batch.read', 'batch.create', 'batch.attest'] },
    { label: t('command.farms.label'), hint: t('command.farms.hint'), path: '/farms', icon: Trees, permissions: ['farm.read', 'farm.create'] },
    { label: t('command.contracts.label'), hint: t('command.contracts.hint'), path: '/contracts', icon: FileText, permissions: ['contract.read'] },
    { label: t('command.shipments.label'), hint: t('command.shipments.hint'), path: '/shipments', icon: Ship, permissions: ['shipment.read', 'shipment.update'] },
  ].filter((item) => item.permissions.length === 0 || item.permissions.some((permission) => user?.permissions.includes('*') || user?.permissions.includes(permission)))
    .filter((item) => !commandSearch || `${item.label} ${item.hint}`.toLowerCase().includes(commandSearch.toLowerCase())), [commandSearch, user?.permissions, t]);

  const chooseCommand = (path: string) => { setCommandOpen(false); setCommandSearch(''); navigate(path); };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-darker">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentPage={currentPage}
        onNavigate={() => setSidebarOpen(false)}
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[272px] border-r border-white/10 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="min-h-20 bg-surface-dark/95 backdrop-blur border-b border-border flex items-center px-4 sm:px-7 gap-4 shrink-0">
          <button
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-border text-text-secondary hover:bg-surface-light hover:text-text-primary"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('shell.openNav')}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{t(`title.${currentPage}`, currentPage)}</h1>
            <p className="mt-0.5 hidden truncate text-[11px] text-text-muted sm:block">{t(`description.${currentPage}`, '')}</p>
          </div>
          <LanguageSelector />
          <div className="flex items-center gap-2">{actions}</div>
          <button className="hidden min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[11px] text-text-muted transition hover:border-brand-400/30 hover:text-text-primary md:flex" onClick={() => setCommandOpen(true)}><Search size={14} /> {t('shell.find')} <kbd className="ml-3 rounded border border-border bg-surface-darker px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd></button>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(109,190,90,.6)]" />
            <div className="max-w-36 leading-tight"><div className="truncate text-[11px] font-semibold text-text-primary">{user?.orgName}</div><div className="truncate text-[9px] uppercase tracking-wider text-text-muted">{user?.orgType}</div></div>
          </div>
        </header>

        <main lang="en" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {commandOpen && <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setCommandOpen(false)}><div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface-dark shadow-2xl shadow-black/50" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-5"><Search size={18} className="text-brand-400" /><input autoFocus className="min-h-16 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-text-muted" placeholder={t('shell.searchPlaceholder')} value={commandSearch} onChange={(event) => setCommandSearch(event.target.value)} /><button className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white" onClick={() => setCommandOpen(false)}><X size={16} /></button></div>
        <div className="max-h-[52vh] overflow-y-auto p-2">{commandItems.length ? commandItems.map((item) => { const Icon = item.icon; return <button key={item.path} onClick={() => chooseCommand(item.path)} className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-white/[.05]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/10 text-brand-400"><Icon size={17} /></span><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[10px] text-text-muted">{item.hint}</span></span><span className="text-xs text-text-muted opacity-0 group-hover:opacity-100">{t('shell.open')}</span></button>; }) : <div className="p-10 text-center text-xs text-text-muted">{t('shell.noMatch')}</div>}</div>
        <div className="border-t border-border px-5 py-3 text-[9px] text-text-muted">{t('shell.searchHint')}</div>
      </div></div>}
      <PilotFeedback currentPage={currentPage} />
    </div>
  );
}
