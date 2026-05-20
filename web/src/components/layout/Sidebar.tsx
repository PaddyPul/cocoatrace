import { useAuthCtx } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';

interface NavItem {
  icon: string;
  label: string;
  page: string;
}

const NAV_CONFIG: Record<string, NavItem[]> = {
  farmer: [
    { icon: '🌿', label: 'Dashboard', page: 'dashboard' },
    { icon: '🏡', label: 'My Farms', page: 'farms' },
    { icon: '📦', label: 'Batches', page: 'batches' },
    { icon: '📋', label: 'Certificates', page: 'certs' },
  ],
  certifier: [
    { icon: '◉', label: 'Dashboard', page: 'dashboard' },
    { icon: '📋', label: 'Certificates', page: 'certs' },
    { icon: '⏳', label: 'Attest Batches', page: 'batches' },
    { icon: '🏅', label: 'Issued Certs', page: 'issued_certs' },
  ],
  exporter: [
    { icon: '◉', label: 'Dashboard', page: 'dashboard' },
    { icon: '📦', label: 'Inventory', page: 'holdings' },
    { icon: '🌾', label: 'Batches', page: 'batches' },
    { icon: '🏷', label: 'Listings', page: 'listings' },
    { icon: '📄', label: 'Contracts', page: 'contracts' },
    { icon: '🚢', label: 'Shipments', page: 'shipments' },
    { icon: '💰', label: 'Payments', page: 'payments' },
    { icon: '🗂', label: 'Evidence', page: 'evidence' },
  ],
  importer: [
    { icon: '◉', label: 'Dashboard', page: 'dashboard' },
    { icon: '🏪', label: 'Marketplace', page: 'marketplace' },
    { icon: '📄', label: 'Contracts', page: 'contracts' },
    { icon: '🚢', label: 'Shipments', page: 'shipments' },
    { icon: '💰', label: 'Payments', page: 'payments' },
  ],
  logistics: [
    { icon: '🚢', label: 'Dashboard', page: 'dashboard' },
    { icon: '📍', label: 'All Shipments', page: 'shipments' },
    { icon: '🗂', label: 'Evidence', page: 'evidence' },
  ],
  regulator: [
    { icon: '◉', label: 'Audit Dashboard', page: 'dashboard' },
    { icon: '🌾', label: 'Farms', page: 'farms' },
    { icon: '📦', label: 'Batches', page: 'batches' },
    { icon: '📋', label: 'Certificates', page: 'certs' },
    { icon: '🔗', label: 'Audit Log', page: 'audit' },
  ],
  admin: [
    { icon: '◉', label: 'Dashboard', page: 'dashboard' },
    { icon: '📦', label: 'Batches', page: 'batches' },
    { icon: '📄', label: 'Contracts', page: 'contracts' },
    { icon: '🚢', label: 'Shipments', page: 'shipments' },
    { icon: '🔗', label: 'Audit Log', page: 'audit' },
  ],
};

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
  const navigate = useNavigate();
  const orgType = user?.orgType || 'admin';
  const navItems = NAV_CONFIG[orgType] || NAV_CONFIG.admin;

  const go = (page: string) => {
    navigate('/' + page);
    onNavigate();
  };

  return (
    <aside className={className + ' flex flex-col overflow-y-auto'}>
      <div
        className="flex items-center gap-2.5 px-4 py-4 border-b border-border shrink-0 cursor-pointer"
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
              {user?.orgName} · {orgType}
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
