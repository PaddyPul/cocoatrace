import { useAuthCtx } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { X } from 'lucide-react';

interface NavItem {
  icon: string;
  label: string;
  page: string;
  orPermissions: string[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: '◉', label: 'Dashboard', page: 'dashboard', orPermissions: [] },
  { icon: '🏡', label: 'Farms', page: 'farms', orPermissions: ['farm.read', 'farm.create'] },
  { icon: '📦', label: 'Batches', page: 'batches', orPermissions: ['batch.read', 'batch.create', 'batch.attest'] },
  { icon: '🏪', label: 'Marketplace', page: 'marketplace', orPermissions: ['listing.read', 'offer.create'] },
  { icon: '📦', label: 'Holdings', page: 'holdings', orPermissions: ['holding.read', 'holding.create', 'listing.create'] },
  { icon: '🏷', label: 'Listings', page: 'listings', orPermissions: ['listing.read', 'listing.create'] },
  { icon: '📄', label: 'Contracts', page: 'contracts', orPermissions: ['contract.read', 'offer.respond', 'offer.create'] },
  { icon: '🚢', label: 'Shipments', page: 'shipments', orPermissions: ['shipment.read', 'shipment.request', 'shipment.update', 'shipment.accept'] },
  { icon: '💰', label: 'Payments', page: 'payments', orPermissions: ['payment.read', 'payment.request', 'payment.confirm'] },
  { icon: '📋', label: 'Certificates', page: 'certs', orPermissions: ['certificate.read', 'certificate.issue'] },
  { icon: '🗂', label: 'Evidence', page: 'evidence', orPermissions: ['evidence.read', 'evidence.upload'] },
  { icon: '🔗', label: 'Audit Log', page: 'audit', orPermissions: ['audit.read'] },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  className,
}: {
  currentPage: string;
  onNavigate: () => void;
  className?: string;
}) {
  const { user, logout } = useAuthCtx();
  const { canAny } = usePermission();
  const navigate = useNavigate();
  const navItems = NAV_ITEMS.filter((n) => n.orPermissions.length === 0 || canAny(...n.orPermissions));

  const go = (page: string) => {
    navigate('/' + page);
    onNavigate();
  };

  return (
    <aside className={className + ' flex flex-col overflow-y-auto'}>
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border shrink-0">
        <div
          className="flex items-center gap-2.5 flex-1 cursor-pointer"
          onClick={() => go('dashboard')}
        >
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-base shrink-0">
            🫘
          </div>
          <div>
            <div className="text-xs font-semibold">CocoaTrace</div>
            <div className="text-[10px] text-text-muted font-mono">Provenance Platform</div>
          </div>
        </div>
        <button
          className="lg:hidden text-text-secondary hover:text-text-primary p-1"
          onClick={onNavigate}
          title="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="py-2.5">
        <div className="text-[10px] text-text-muted uppercase tracking-wider px-4 mb-1">
          Navigation
        </div>
        {navItems.map((n) => (
          <div
            key={n.page}
            onClick={() => go(n.page)}
            className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer text-xs text-text-secondary border-l-2 border-transparent transition-all hover:bg-brand-500/10 hover:text-text-primary ${
              currentPage === n.page
                ? 'bg-brand-500/10 text-brand-400 border-l-brand-400'
                : ''
            }`}
          >
            <span className="w-4 text-center text-sm">{n.icon}</span>
            {n.label}
          </div>
        ))}
      </div>

      <div className="mt-auto px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
            {(user?.name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium">{user?.name}</div>
            <div className="text-[10px] text-text-muted">
              {user?.orgName} · {(user?.roles || []).join(', ') || user?.orgType}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          GH → NL active
        </div>
        <button
          onClick={logout}
          className="btn btn-sm w-full justify-center mt-2.5"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
