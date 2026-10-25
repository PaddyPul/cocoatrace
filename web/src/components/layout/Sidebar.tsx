import '../../navigation/sidebar.css';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BadgeCheck,
  Boxes,
  Building2,
  FileCheck2,
  FileClock,
  Handshake,
  Home,
  KeyRound,
  Leaf,
  LifeBuoy,
  LogOut,
  LucideIcon,
  PackageCheck,
  QrCode,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Ship,
  ShoppingBag,
  Store,
  Trees,
  UserCheck,
  WalletCards,
  X,
  Search,
  LayoutDashboard,
} from 'lucide-react';
import { useAuthCtx } from '../auth/AuthProvider';
import { usePermission } from '../../hooks/usePermission';
import { useNavigationLanguage as useLanguage } from '../../navigation/useNavigationLanguage';
import { workspace } from '../../api';
import { navigation, activeNavigation, type NavigationItem } from '../../navigation/model';
import { useWorkspace } from '../../navigation/useWorkspace';

export const navigationIcons: Record<string, LucideIcon> = {
  Home,
  Store,
  Search,
  ShoppingBag,
  Handshake,
  ScrollText,
  QrCode,
  ShieldAlert,
  Ship,
  WalletCards,
  Trees,
  Boxes,
  BadgeCheck,
  FileCheck2,
  PackageCheck,
  Bell,
  LifeBuoy,
  FileClock,
  Building2,
  UserCheck,
  LayoutDashboard,
};

export default function Sidebar({
  currentPage,
  onNavigate,
  className = '',
  offerCount = null,
}: {
  currentPage: string;
  onNavigate: () => void;
  className?: string;
  offerCount?: number | null;
}) {
  const { user, logout, onboarding, refreshOnboarding } = useAuthCtx();
  const { t } = useLanguage();
  const { canAny } = usePermission();
  const navigate = useNavigate();
  const { mode, available, switchWorkspace } = useWorkspace();
  const menu = navigation(user, mode);
  const go = (item: { page?: string; path?: string }) => {
    navigate(item.path || '/' + item.page);
    onNavigate();
  };
  const replayWelcome = async () => {
    await workspace.updateOnboarding({
      status: 'not_started',
      currentStep: 0,
      primaryGoal:
        onboarding?.primary_goal || (canAny('listing.create') ? 'sell_verified' : 'buy_verified'),
      pilotMode: onboarding?.pilot_mode ?? true,
    });
    await refreshOnboarding();
    navigate('/onboarding');
    onNavigate();
  };
  const renderItem = (item: NavigationItem, primary = false, utility = false) => {
    const Icon = navigationIcons[item.icon] || Home;
    const selected = !primary && activeNavigation(item.id, currentPage);
    const badge = item.id === 'offers' && offerCount !== null && offerCount > 0;
    return (
      <button
        key={item.id}
        aria-label={t(item.label)}
        aria-current={selected ? 'page' : undefined}
        aria-describedby={
          badge ? `offer-count-${className.includes('w-') ? 'desktop' : 'mobile'}` : undefined
        }
        onClick={() => go(item)}
        className={`group flex min-h-11 w-full items-center rounded-xl font-medium transition ${utility ? 'flex-col justify-center gap-1 px-1 py-2 text-center text-[10px]' : 'gap-3 px-3 py-2.5 text-left text-xs'} ${primary ? 'bg-brand-400 text-emerald-950 hover:bg-brand-300' : selected ? 'bg-white text-emerald-950' : item.id === 'recalls' ? 'text-amber-100 hover:bg-amber-300/10' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
      >
        <Icon size={17} aria-hidden="true" />
        <span className={utility ? 'leading-tight' : 'flex-1'}>{t(item.label)}</span>
        {badge && (
          <>
            <span aria-hidden="true" className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-xs">
              {offerCount}
            </span>
            <span
              className="sr-only"
              id={`offer-count-${className.includes('w-') ? 'desktop' : 'mobile'}`}
            >
              {offerCount} {t(mode === 'buy' ? 'nav.awaiting-supplier' : 'nav.awaiting-you')}
            </span>
          </>
        )}
      </button>
    );
  };
  return (
    <aside
      className={`${className} workspace-sidebar relative flex min-h-0 flex-col overflow-hidden bg-[#0c1913] text-white`}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => go({ page: 'home' })}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500">
            <Leaf size={20} />
          </span>
          <span>
            <span className="block text-[15px] font-bold">BetterTrade</span>
            <span className="block text-[10px] text-emerald-200/60">{t('shell.verified')}</span>
          </span>
        </button>
        <button
          className="rounded-lg p-2 lg:hidden"
          onClick={onNavigate}
          aria-label={t('shell.close')}
        >
          <X size={18} />
        </button>
      </div>
      <nav
        aria-label={t('nav.navigation')}
        className="workspace-menu flex min-h-0 flex-1 flex-col px-3 py-2"
      >
        <div data-testid="workspace-primary-navigation" className="shrink-0 space-y-2 pb-3">
          {available.length > 1 ? (
            <label className="block px-1 text-xs text-white/70">
              {t('nav.workspace')}
              <select
                className="form-select mt-1 w-full"
                value={mode}
                onChange={(event) => {
                  switchWorkspace(event.target.value as typeof mode);
                  onNavigate();
                }}
              >
                {available.map((value) => (
                  <option key={value} value={value}>
                    {t(`workspace.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="px-3 py-1 text-xs font-semibold text-emerald-200">
              {t(`workspace.${mode}`)}
            </p>
          )}
          {menu.create && renderItem(menu.create, true)}
          {menu.groups
            .filter((group) => !group.collapsible)
            .map((group) => (
              <section key={group.id} aria-label={t(group.label)} className="space-y-1">
                {group.items.map((item) => renderItem(item))}
              </section>
            ))}
        </div>
        <div
          data-testid="workspace-secondary-navigation"
          className="workspace-secondary min-h-0 flex-1 overflow-y-auto pb-2"
        >
          {menu.groups
            .filter((group) => group.collapsible)
            .map((group) => (
              <details
                key={group.id}
                open={
                  group.items.some((item) => activeNavigation(item.id, currentPage)) || undefined
                }
                className="rounded-xl border border-white/10 p-2"
              >
                <summary className="sticky top-0 z-10 cursor-pointer bg-[#0c1913] px-1 py-2 text-xs font-semibold text-white/70">
                  {t(group.label)}
                </summary>
                <div className="space-y-1">{group.items.map((item) => renderItem(item))}</div>
              </details>
            ))}
        </div>
        <section
          aria-label={t('nav.help-safety')}
          className="shrink-0 border-t border-white/10 pt-2"
        >
          <div className="grid grid-cols-3 gap-1">
            {menu.utility.map((item) => renderItem(item, false, true))}
          </div>
        </section>
      </nav>
      <div className="relative mx-3 mb-3 mt-auto shrink-0 rounded-xl border border-white/10 bg-white/[0.05] p-3">
        <details className="mb-2">
          <summary className="cursor-pointer text-xs text-white/70">
            {t('nav.account-help')}
          </summary>
          <div className="workspace-account-options absolute inset-x-0 bottom-full z-20 mb-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-white/15 bg-[#0c1913] p-3 shadow-xl">
            <button
              onClick={replayWelcome}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-[10px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={13} /> {t('shell.replay')}
            </button>
            <button
              onClick={() => go({ page: 'pilot-limitations', path: '/pilot/limitations' })}
              className="mb-3 min-h-11 w-full rounded-xl border border-white/10 px-3 py-2 text-left text-xs text-white/70"
            >
              Known pilot limitations
            </button>
            <button
              onClick={() => go({ page: 'account-security', path: '/account/security' })}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-[10px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <KeyRound size={13} /> {t('shell.security')}
            </button>
          </div>
        </details>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-300/15 text-xs font-bold text-emerald-200">
            {(user?.name || '?')
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{user?.name}</div>
            <div className="truncate text-[10px] text-white/40">{user?.orgName}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label={t('shell.logout')}
            title={t('shell.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
