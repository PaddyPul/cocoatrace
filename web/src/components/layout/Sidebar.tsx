import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Boxes, Building2, FileCheck2, FileClock, Handshake, Home, KeyRound, Leaf, LogOut, LucideIcon, PackageCheck, QrCode, RefreshCw, ScrollText, ShieldAlert, Ship, ShoppingBag, Store, Trees, UserCheck, WalletCards, X } from 'lucide-react';
import { useAuthCtx } from '../auth/AuthProvider';
import { usePermission } from '../../hooks/usePermission';
import { useLanguage } from '../../i18n/LanguageProvider';
import { workspace } from '../../api';

interface NavItem { icon: LucideIcon; label: string; page: string; path?: string; orPermissions: string[]; emphasis?: 'safety'; }
interface NavGroup { label: string; items: NavItem[]; }

const PRIMARY_NAV: NavGroup[] = [{ label: 'group.0', items: [
  { icon: Home, label: 'nav.home', page: 'home', orPermissions: [] },
  { icon: Store, label: 'nav.marketplace', page: 'marketplace', orPermissions: ['listing.read', 'offer.create'] },
  { icon: ShoppingBag, label: 'nav.supply-new', page: 'supply-new', path: '/supply/new', orPermissions: ['listing.create'] },
  { icon: Handshake, label: 'nav.offers', page: 'offers', orPermissions: ['offer.respond', 'offer.create'] },
  { icon: ScrollText, label: 'nav.contracts', page: 'contracts', orPermissions: ['contract.read', 'offer.respond', 'offer.create'] },
  { icon: QrCode, label: 'nav.products', page: 'products', orPermissions: ['batch.read'] },
  { icon: ShieldAlert, label: 'nav.recalls', page: 'recalls', orPermissions: [], emphasis: 'safety' },
] }];

const TRADE_NAV: NavGroup = { label: 'group.1', items: [
  { icon: Ship, label: 'nav.shipments', page: 'shipments', orPermissions: ['shipment.read', 'shipment.update'] },
  { icon: WalletCards, label: 'nav.platform-fees', page: 'platform-fees', orPermissions: ['offer.respond','finance.manage'] },
  { icon: WalletCards, label: 'nav.payments', page: 'payments', orPermissions: ['payment.read', 'payment.request', 'payment.confirm'] },
] };

const TOOL_NAV: NavGroup[] = [
  { label: 'group.2', items: [
    { icon: Trees, label: 'nav.farms', page: 'farms', orPermissions: ['farm.read', 'farm.create'] },
    { icon: Boxes, label: 'nav.batches', page: 'batches', orPermissions: ['batch.read', 'batch.create', 'batch.attest'] },
    { icon: BadgeCheck, label: 'nav.certs', page: 'certs', orPermissions: ['certificate.read', 'certificate.issue'] },
    { icon: FileCheck2, label: 'nav.evidence', page: 'evidence', orPermissions: ['evidence.read', 'evidence.upload'] },
  ] },
  { label: 'group.3', items: [
    { icon: ShoppingBag, label: 'nav.my-listings', page: 'my-listings', orPermissions: ['listing.create'] },
    { icon: PackageCheck, label: 'nav.holdings', page: 'holdings', orPermissions: ['holding.read', 'holding.create', 'listing.create'] },
  ] },
  { label: 'group.4', items: [
    { icon: FileClock, label: 'nav.audit', page: 'audit', orPermissions: ['audit.read'] },
    { icon: Building2, label: 'nav.organizations', page: 'organizations', orPermissions: ['organization.admin'] },
    { icon: ShieldAlert, label: 'nav.access-controls', page: 'access-controls', path: '/access-controls', orPermissions: ['*'] },
    { icon: UserCheck, label: 'nav.access-applications', page: 'access-applications', path: '/access-applications', orPermissions: ['*'] },
  ] },
];

export default function Sidebar({ currentPage, onNavigate, className = '' }: { currentPage: string; onNavigate: () => void; className?: string; }) {
  const { user, logout, onboarding, refreshOnboarding } = useAuthCtx();
  const { t } = useLanguage();
  const { canAny } = usePermission();
  const navigate = useNavigate();
  const go = (item: Pick<NavItem, 'page' | 'path'>) => { navigate(item.path || '/' + item.page); onNavigate(); };
  const setMode = (mode: 'buy' | 'sell') => { localStorage.setItem('ct_experience_mode', mode); navigate(`/home?mode=${mode}`); onNavigate(); };
  const isActive = (item: NavItem) => currentPage === item.page || currentPage + 's' === item.page || (currentPage === 'deal-room' && item.page === 'contracts');

  const replayWelcome = async () => {
    await workspace.updateOnboarding({ status: 'not_started', currentStep: 0, primaryGoal: onboarding?.primary_goal || (canAny('listing.create') ? 'sell_verified' : 'buy_verified'), pilotMode: onboarding?.pilot_mode ?? true });
    await refreshOnboarding();
    navigate('/onboarding'); onNavigate();
  };

  const renderItem = (item: NavItem, compact = false) => { const Icon = item.icon; const selected = isActive(item); return <button key={item.page} onClick={() => go(item)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-all ${selected ? 'bg-white text-emerald-950 shadow-lg shadow-black/10' : item.emphasis === 'safety' ? 'text-amber-100 hover:bg-amber-300/10' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'}`}><Icon size={compact ? 16 : 17} className={selected ? 'text-brand-600' : item.emphasis === 'safety' ? 'text-amber-300' : 'text-white/40 group-hover:text-brand-300'} /><span className="flex-1">{t(item.label)}</span>{item.emphasis === 'safety' && <span className={`h-2 w-2 rounded-full ${selected ? 'bg-amber-500' : 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.45)]'}`} />}</button>; };

  return <aside className={`${className} flex flex-col overflow-y-auto bg-[#0c1913] text-white`}>
    <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-5">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go({ page: 'home' })}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-900/40"><Leaf size={20} /></span><span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight">CocoaTrace</span><span className="block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/50">{t('shell.verified')}</span></span></button>
      <button className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" onClick={onNavigate} title={t('shell.close')}><X size={18} /></button>
    </div>
    <nav className="flex-1 space-y-5 px-3 py-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/15 p-1"><button onClick={() => setMode('buy')} className="rounded-xl px-3 py-2 text-[11px] font-bold text-white/65 transition hover:bg-white/10 hover:text-white">{t('shell.buy')}</button><button onClick={() => setMode('sell')} className="rounded-xl px-3 py-2 text-[11px] font-bold text-white/65 transition hover:bg-white/10 hover:text-white">{t('shell.sell')}</button></div>
      {PRIMARY_NAV.map((group) => { const items = group.items.filter((item) => !item.orPermissions.length || canAny(...item.orPermissions)); return items.length ? <section key={t(group.label)}><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">{t(group.label)}</div><div className="space-y-1">{items.map((item) => renderItem(item))}</div></section> : null; })}
      {(() => { const items = TRADE_NAV.items.filter((item) => canAny(...item.orPermissions)); return items.length ? <section><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">{t(TRADE_NAV.label)}</div><div className="space-y-1">{items.map((item) => renderItem(item))}</div></section> : null; })()}
      <details open={TOOL_NAV.some((group) => group.items.some(isActive)) || undefined} className="group rounded-xl border border-white/10 bg-white/[.025] p-2"><summary className="cursor-pointer list-none rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-white/40 transition hover:bg-white/[.05] hover:text-white/70">{t('shell.admin')} <span className="float-right text-white/25 transition group-open:rotate-45">+</span></summary><div className="mt-3 space-y-5 border-t border-white/10 pt-3">{TOOL_NAV.map((group) => { const items = group.items.filter((item) => !item.orPermissions.length || canAny(...item.orPermissions)); return items.length ? <section key={t(group.label)}><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">{t(group.label)}</div><div className="space-y-1">{items.map((item) => renderItem(item, true))}</div></section> : null; })}</div></details>
    </nav>
    <div className="m-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
      <button onClick={replayWelcome} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-[10px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"><RefreshCw size={13} /> {t('shell.replay')}</button>
      <button onClick={() => go({ page: 'account-security', path: '/account/security' })} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-[10px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"><KeyRound size={13} /> {t('shell.security')}</button>
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-300/15 text-xs font-bold text-emerald-200">{(user?.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{user?.name}</div><div className="truncate text-[10px] text-white/40">{user?.orgName}</div></div><button onClick={logout} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" title={t('shell.logout')}><LogOut size={16} /></button></div>
      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-emerald-200/60"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" />{t('shell.corridor')}</div>
    </div>
  </aside>;
}
