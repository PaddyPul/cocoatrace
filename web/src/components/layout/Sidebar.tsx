import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Boxes, Building2, FileCheck2, FileClock, Handshake,
  LayoutDashboard, Leaf, LogOut, LucideIcon, PackageCheck,
  ScrollText, ShieldAlert, Ship, ShoppingBag, Store, Trees, WalletCards, X,
} from 'lucide-react';
import { useAuthCtx } from '../auth/AuthProvider';
import { usePermission } from '../../hooks/usePermission';

interface NavItem {
  icon: LucideIcon;
  label: string;
  page: string;
  orPermissions: string[];
  emphasis?: 'safety';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard', orPermissions: [] }],
  },
  {
    label: 'Traceability',
    items: [
      { icon: Trees, label: 'Farms', page: 'farms', orPermissions: ['farm.read', 'farm.create'] },
      { icon: Boxes, label: 'Harvest batches', page: 'batches', orPermissions: ['batch.read', 'batch.create', 'batch.attest'] },
      { icon: ShieldAlert, label: 'Traceability & recalls', page: 'recalls', orPermissions: ['batch.read', 'recall.manage'], emphasis: 'safety' },
      { icon: BadgeCheck, label: 'Certificates', page: 'certs', orPermissions: ['certificate.read', 'certificate.issue'] },
      { icon: FileCheck2, label: 'Evidence', page: 'evidence', orPermissions: ['evidence.read', 'evidence.upload'] },
    ],
  },
  {
    label: 'Trade operations',
    items: [
      { icon: Store, label: 'Marketplace', page: 'marketplace', orPermissions: ['listing.read', 'offer.create'] },
      { icon: ShoppingBag, label: 'My listings', page: 'my-listings', orPermissions: ['listing.create'] },
      { icon: PackageCheck, label: 'Inventory', page: 'holdings', orPermissions: ['holding.read', 'holding.create', 'listing.create'] },
      { icon: Handshake, label: 'Offers', page: 'offers', orPermissions: ['offer.respond', 'offer.create'] },
      { icon: ScrollText, label: 'Contracts', page: 'contracts', orPermissions: ['contract.read', 'offer.respond', 'offer.create'] },
      { icon: Ship, label: 'Shipments', page: 'shipments', orPermissions: ['shipment.read', 'shipment.request', 'shipment.update', 'shipment.accept'] },
      { icon: WalletCards, label: 'Payments', page: 'payments', orPermissions: ['payment.read', 'payment.request', 'payment.confirm'] },
    ],
  },
  {
    label: 'Governance',
    items: [
      { icon: FileClock, label: 'Audit log', page: 'audit', orPermissions: ['audit.read'] },
      { icon: Building2, label: 'Organizations', page: 'organizations', orPermissions: ['organization.admin'] },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate, className = '' }: {
  currentPage: string;
  onNavigate: () => void;
  className?: string;
}) {
  const { user, logout } = useAuthCtx();
  const { canAny } = usePermission();
  const navigate = useNavigate();

  const go = (page: string) => {
    navigate('/' + page);
    onNavigate();
  };

  return (
    <aside className={`${className} flex flex-col overflow-y-auto bg-[#0c1913] text-white`}>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go('dashboard')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-900/40"><Leaf size={20} /></span>
          <span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight">CocoaTrace</span><span className="block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/50">Product intelligence</span></span>
        </button>
        <button className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" onClick={onNavigate} title="Close navigation"><X size={18} /></button>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.orPermissions.length === 0 || canAny(...item.orPermissions));
          if (!items.length) return null;
          return <section key={group.label}>
            <div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">{group.label}</div>
            <div className="space-y-1">{items.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.page || currentPage + 's' === item.page;
              return <button key={item.page} onClick={() => go(item.page)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-all ${active ? 'bg-white text-emerald-950 shadow-lg shadow-black/10' : item.emphasis === 'safety' ? 'text-amber-100 hover:bg-amber-300/10' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'}`}>
                <Icon size={17} className={active ? 'text-brand-600' : item.emphasis === 'safety' ? 'text-amber-300' : 'text-white/40 group-hover:text-brand-300'} />
                <span className="flex-1">{item.label}</span>
                {item.emphasis === 'safety' && <span className={`h-2 w-2 rounded-full ${active ? 'bg-amber-500' : 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.45)]'}`} />}
              </button>;
            })}</div>
          </section>;
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-300/15 text-xs font-bold text-emerald-200">{(user?.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{user?.name}</div><div className="truncate text-[10px] text-white/40">{user?.orgName}</div></div>
          <button onClick={logout} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" title="Sign out"><LogOut size={16} /></button>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-emerald-200/60"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" />Ghana → Netherlands corridor</div>
      </div>
    </aside>
  );
}
