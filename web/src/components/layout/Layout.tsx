import { ReactNode, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  demo: 'Investor Demo',
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
  recalls: 'Traceability & Recalls',
  audit: 'Audit Log',
  certs: 'Certificates',
  'my-listings': 'My Listings',
  organizations: 'Organizations',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  demo: 'The scan, verification and recall story in one guided flow.',
  dashboard: 'Your operational priorities across provenance, trade and compliance.',
  marketplace: 'Discover verified cocoa inventory available for trade.',
  listing: 'Review commercial terms and provenance before making a decision.',
  farms: 'Manage origin identities, plots and verification readiness.',
  farm: 'Review this farm’s plots, certificates and production history.',
  batches: 'Follow harvested material from origin through custody and sale.',
  batch: 'Inspect provenance, evidence, custody and the public product identity.',
  holdings: 'Monitor the physical inventory currently under custody.',
  holding: 'Review quantity, location and custody actions for this holding.',
  offers: 'Review and respond to commercial proposals.',
  contracts: 'Track agreed trades from signature through settlement.',
  shipments: 'Monitor logistics milestones from origin to destination.',
  payments: 'Track requested, confirmed and outstanding payments.',
  evidence: 'Manage the documents and hashes supporting product claims.',
  recalls: 'Investigate lot genealogy, calculate impact and protect recipients.',
  audit: 'Review the immutable record of sensitive platform activity.',
  certs: 'Manage certification coverage, validity and status.',
  'my-listings': 'Manage inventory currently offered to buyers.',
  organizations: 'Manage supply-chain participants and platform access.',
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
  const { user } = useAuthCtx();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{PAGE_TITLES[currentPage] || currentPage}</h1>
            <p className="mt-0.5 hidden truncate text-[11px] text-text-muted sm:block">{PAGE_DESCRIPTIONS[currentPage]}</p>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(109,190,90,.6)]" />
            <div className="max-w-36 leading-tight"><div className="truncate text-[11px] font-semibold text-text-primary">{user?.orgName}</div><div className="truncate text-[9px] uppercase tracking-wider text-text-muted">{user?.orgType}</div></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
