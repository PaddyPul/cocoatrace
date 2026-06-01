import { ReactNode, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import Sidebar from './Sidebar';
import { LogOut, Menu } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  marketplace: 'Marketplace',
  listing: 'Listing Details',
  farm: 'Farm Details',
  farms: 'Farms',
  batch: 'Batch Details',
  batches: 'Harvest Batches',
  holding: 'Holding Details',
  holdings: 'Inventory Holdings',
  offers: 'Offers',
  contracts: 'Sales Contracts',
  shipments: 'Shipments',
  payments: 'Payments',
  evidence: 'Evidence Documents',
  audit: 'Audit Log',
  certs: 'Certificates',
  'my-listings': 'My Listings',
  organizations: 'Organizations',
};

export default function Layout({
  children,
  currentPage,
  actions,
}: {
  children: ReactNode;
  currentPage: string;
  actions?: ReactNode;
}) {
  const { user, logout } = useAuthCtx();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-surface-dark border-r border-border transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-13 bg-surface-dark border-b border-border flex items-center px-5 gap-3 shrink-0">
          <button
            className="lg:hidden text-text-secondary hover:text-text-primary"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold flex-1">
            {PAGE_TITLES[currentPage] || currentPage}
          </h1>
          {actions}
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="hidden sm:inline">{user?.name}</span>
            <button
              onClick={logout}
              className="btn btn-sm"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
