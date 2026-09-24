import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';
import { Boxes, FileText, GitBranch, Home, LayoutDashboard, Menu, QrCode, Search, Ship, ShoppingBag, Sparkles, Trees, X } from 'lucide-react';
import PilotFeedback from '../shared/PilotFeedback';

const PAGE_TITLES: Record<string, string> = {
  home: 'Your sourcing workspace',
  'source-new': 'Create a sourcing brief',
  'source-compare': 'Compare verified supply',
  'supply-new': 'Publish verified supply',
  'deal-room': 'Shared deal room',
  demo: 'Investor Demo',
  products: 'Products',
  dashboard: 'Control Tower',
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
  pilot: 'Pilot Team',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home: 'Move from a requirement to a verified trade, with one evidence trail.',
  'source-new': 'Describe what you need; CocoaTrace turns it into a buyer-ready requirement.',
  'source-compare': 'Compare commercial fit and supporting proof side by side.',
  'supply-new': 'Turn traceable inventory into a buyer-ready offer.',
  'deal-room': 'Keep commitments, evidence and execution visible to both sides.',
  demo: 'The scan, verification and recall story in one guided flow.',
  products: 'Living product passports connected to evidence, provenance and safety.',
  dashboard: 'Product readiness, evidence gaps and safety risk across your network.',
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
  pilot: 'Invite named design partners and track pilot participation.',
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
    { label: 'Home', hint: 'Your current decisions and next actions', path: '/home', icon: Home, permissions: [] },
    { label: 'Find verified supply', hint: 'Source by requirement, not by paperwork', path: '/source/new', icon: Search, permissions: ['offer.create'] },
    { label: 'Publish supply', hint: 'Offer an evidence-backed lot to buyers', path: '/supply/new', icon: ShoppingBag, permissions: ['listing.create'] },
    { label: 'Control Tower', hint: 'Network health and priorities', path: '/dashboard', icon: LayoutDashboard, permissions: [] },
    { label: 'Investor Demo', hint: 'Scan, verify and respond story', path: '/demo', icon: Sparkles, permissions: [] },
    { label: 'Products', hint: 'Product passports and safety state', path: '/products', icon: QrCode, permissions: ['batch.read'] },
    { label: 'Trace & Recall', hint: 'Genealogy and incident response', path: '/recalls', icon: GitBranch, permissions: ['batch.read', 'recall.manage'] },
    { label: 'Harvest Batches', hint: 'Source material and verification', path: '/batches', icon: Boxes, permissions: ['batch.read', 'batch.create', 'batch.attest'] },
    { label: 'Farms', hint: 'Origin and geolocation', path: '/farms', icon: Trees, permissions: ['farm.read', 'farm.create'] },
    { label: 'Contracts', hint: 'Buyer and seller agreements', path: '/contracts', icon: FileText, permissions: ['contract.read'] },
    { label: 'Shipments', hint: 'Logistics and milestones', path: '/shipments', icon: Ship, permissions: ['shipment.read', 'shipment.update'] },
  ].filter((item) => item.permissions.length === 0 || item.permissions.some((permission) => user?.permissions.includes('*') || user?.permissions.includes(permission)))
    .filter((item) => !commandSearch || `${item.label} ${item.hint}`.toLowerCase().includes(commandSearch.toLowerCase())), [commandSearch, user?.permissions]);

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
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{PAGE_TITLES[currentPage] || currentPage}</h1>
            <p className="mt-0.5 hidden truncate text-[11px] text-text-muted sm:block">{PAGE_DESCRIPTIONS[currentPage]}</p>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
          <button className="hidden min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[11px] text-text-muted transition hover:border-brand-400/30 hover:text-text-primary md:flex" onClick={() => setCommandOpen(true)}><Search size={14} /> Find anything <kbd className="ml-3 rounded border border-border bg-surface-darker px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd></button>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(109,190,90,.6)]" />
            <div className="max-w-36 leading-tight"><div className="truncate text-[11px] font-semibold text-text-primary">{user?.orgName}</div><div className="truncate text-[9px] uppercase tracking-wider text-text-muted">{user?.orgType}</div></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {commandOpen && <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setCommandOpen(false)}><div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface-dark shadow-2xl shadow-black/50" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-5"><Search size={18} className="text-brand-400" /><input autoFocus className="min-h-16 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-text-muted" placeholder="Find a product area or workflow…" value={commandSearch} onChange={(event) => setCommandSearch(event.target.value)} /><button className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white" onClick={() => setCommandOpen(false)}><X size={16} /></button></div>
        <div className="max-h-[52vh] overflow-y-auto p-2">{commandItems.length ? commandItems.map((item) => { const Icon = item.icon; return <button key={item.path} onClick={() => chooseCommand(item.path)} className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-white/[.05]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/10 text-brand-400"><Icon size={17} /></span><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[10px] text-text-muted">{item.hint}</span></span><span className="text-xs text-text-muted opacity-0 group-hover:opacity-100">Open →</span></button>; }) : <div className="p-10 text-center text-xs text-text-muted">No matching workflows</div>}</div>
        <div className="border-t border-border px-5 py-3 text-[9px] text-text-muted">Search is permission-aware · Press Esc to close</div>
      </div></div>}
      <PilotFeedback currentPage={currentPage} />
    </div>
  );
}
