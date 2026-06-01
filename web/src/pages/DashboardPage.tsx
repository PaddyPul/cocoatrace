import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { batches, contracts, shipments, farms, audit, listings, offers as offersApi, certificates as certsApi } from '../api';
import { Batch, Contract, Shipment, Farm, AuditEvent, Listing, Offer } from '../types';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { user, canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const perms = user?.permissions || [];
    const hasAny = (...ps: string[]) => ps.some((p) => perms.includes('*') || perms.includes(p));
    setLoading(true);

    const load = async () => {
      try {
        const promises: Record<string, Promise<any>> = {};
        if (hasAny('batch.read', 'batch.create', 'batch.attest')) promises.batches = batches.list();
        if (hasAny('contract.read')) promises.contracts = contracts.list();
        if (hasAny('shipment.read', 'shipment.request', 'shipment.update', 'shipment.accept')) promises.shipments = shipments.list();
        if (hasAny('farm.read', 'farm.create')) promises.farms = farms.list();
        if (hasAny('listing.read', 'listing.create')) promises.listings = listings.list();
        if (hasAny('audit.read')) promises.audit = audit.list();
        if (hasAny('offer.respond', 'offer.create')) promises.offers = offersApi.list();
        if (hasAny('certificate.read', 'certificate.issue')) promises.certs = certsApi.list();
        const results = await Promise.all(Object.values(promises));
        const keys = Object.keys(promises);
        const mapped: any = {};
        keys.forEach((k, i) => { mapped[k] = results[i]; });
        setData(mapped);
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.permissions]);

  const orgType = user?.orgType || '';

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="loading"><div className="spinner" /><div>Loading dashboard…</div></div>
      </Layout>
    );
  }

  const chooseDash = () => {
    const hasAny = (...ps: string[]) => ps.some((p) => canDo(p));
    if (orgType === 'farmer' && hasAny('farm.read')) return <FarmerDash data={data} navigate={navigate} canDo={canDo} />;
    if (orgType === 'certifier' && hasAny('batch.attest')) return <CertifierDash data={data} navigate={navigate} />;
    if (orgType === 'importer' && hasAny('listing.read')) return <ImporterDash data={data} navigate={navigate} />;
    if (orgType === 'logistics' && hasAny('shipment.read')) return <LogisticsDash data={data} navigate={navigate} />;
    if (orgType === 'regulator' && hasAny('audit.read')) return <RegulatorDash data={data} navigate={navigate} />;
    return <ExporterDash data={data} navigate={navigate} />;
  };

  return (
    <Layout currentPage="dashboard">
      {chooseDash()}
    </Layout>
  );
}

function ActionWidget({ icon, title, count, label, onClick, urgent }: { icon: string; title: string; count: number; label: string; onClick: () => void; urgent?: boolean }) {
  return (
    <div className={`bg-surface border ${urgent ? 'border-yellow-500/30' : 'border-border'} rounded p-4 flex items-start gap-3 cursor-pointer hover:border-brand-500/30 transition-all group`} onClick={onClick}>
      <div className="text-2xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted uppercase tracking-wider">{title}</div>
        {count > 0 ? <div className="text-2xl font-bold font-mono text-text-primary mt-0.5">{count}</div> : <div className="text-sm font-medium text-text-muted mt-1">None</div>}
        <div className="flex items-center gap-1 text-xs text-brand-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {label} <ArrowRight size={12} />
        </div>
      </div>
    </div>
  );
}

function ActionPrompt({ children }: { children: React.ReactNode }) {
  return <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 text-xs text-yellow-400 flex items-start gap-2 mb-4"><span>⚡</span><span>{children}</span></div>;
}

function ExporterDash({ data, navigate }: { data: any; navigate: any }) {
  const { user } = useAuthCtx();
  const batches: Batch[] = data.batches || [];
  const contracts: Contract[] = data.contracts || [];
  const shipments: Shipment[] = data.shipments || [];
  const offers: Offer[] = data.offers || [];
  const listingsArr: Listing[] = data.listings || [];
  const pendingOffers = offers.filter((o) => o.status === 'pending');
  const inTransit = contracts.filter((c) => c.status === 'in_transit');
  const delivered = contracts.filter((c) => c.status === 'delivered');
  const pendingPay = contracts.filter((c) => c.status === 'delivered');
  const myBatches = user ? batches.filter((b) => b.current_holder_id === user.organizationId) : [];
  const unlisted = myBatches.filter((b) => !listingsArr.some((l) => l.batch_id === b.id));

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">Batches</div><div className="stat-value">{batches.length}</div></div>
        <div className="stat-card"><div className="stat-label">Active Contracts</div><div className="stat-value">{contracts.filter((c) => !['settled', 'cancelled'].includes(c.status)).length}</div></div>
        <div className="stat-card"><div className="stat-label">In Transit</div><div className="stat-value text-yellow-400">{inTransit.length}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Payment</div><div className={`stat-value ${pendingPay.length > 0 ? 'text-yellow-400' : 'text-brand-400'}`}>{pendingPay.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <ActionWidget icon="📨" title="Pending Offers" count={pendingOffers.length} label="Review offers" onClick={() => navigate('/offers')} urgent={pendingOffers.length > 0} />
        <ActionWidget icon="🏷" title="Unlisted Batches" count={unlisted.length} label="List on marketplace" onClick={() => navigate('/batches')} urgent={unlisted.length > 0} />
        <ActionWidget icon="🚢" title="Active Shipments" count={inTransit.length} label="Track shipments" onClick={() => navigate('/shipments')} />
        <ActionWidget icon="💰" title="Awaiting Payment" count={delivered.length} label="Request payment" onClick={() => navigate('/payments')} urgent={delivered.length > 0} />
      </div>

      {pendingOffers.length > 0 && <ActionPrompt>You have {pendingOffers.length} pending offer{pendingOffers.length > 1 ? 's' : ''} — review on the Offers page →</ActionPrompt>}
    </>
  );
}

function FarmerDash({ data, navigate, canDo }: { data: any; navigate: any; canDo: (p: string) => boolean }) {
  const { user } = useAuthCtx();
  const farms: Farm[] = data.farms || [];
  const batches: Batch[] = data.batches || [];
  const listingsArr: Listing[] = data.listings || [];
  const myListings = listingsArr.filter((l) => l.seller_organization_id === user?.organizationId);
  const unattested = batches.filter((b) => b.organic_claim_status === 'pending_attestation');
  const noPlotsFarms: any[] = [];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">My Farms</div><div className="stat-value">{farms.length}</div></div>
        <div className="stat-card"><div className="stat-label">Batches</div><div className="stat-value">{batches.length}</div></div>
        <div className="stat-card"><div className="stat-label">Attested</div><div className="stat-value text-brand-400">{batches.filter((b) => b.organic_claim_status === 'attested').length}</div></div>
        <div className="stat-card"><div className="stat-label">My Listings</div><div className="stat-value">{myListings.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {canDo('farm.create') && <ActionWidget icon="🏡" title="Farms" count={farms.length} label={farms.length === 0 ? 'Register your first farm' : 'View farms'} onClick={() => navigate('/farms')} urgent={farms.length === 0} />}
        {canDo('batch.create') && <ActionWidget icon="📦" title="Batches This Season" count={batches.length} label={batches.length === 0 ? 'Create first batch' : 'View batches'} onClick={() => navigate('/batches')} urgent={batches.length === 0} />}
        <ActionWidget icon="🏷" title="Active Listings" count={myListings.length} label={myListings.length === 0 ? 'List on marketplace' : 'Manage listings'} onClick={() => navigate('/my-listings')} urgent={myListings.length === 0 && batches.length > 0} />
      </div>

      {unattested.length > 0 && <ActionPrompt>{unattested.length} batch{unattested.length > 1 ? 'es' : ''} pending certifier attestation — track on Batches page →</ActionPrompt>}
      {noPlotsFarms.length > 0 && <ActionPrompt>{noPlotsFarms.length} farm{noPlotsFarms.length > 1 ? 's' : ''} without plots — add growing areas on the Farm detail page →</ActionPrompt>}
    </>
  );
}

function CertifierDash({ data, navigate }: { data: any; navigate: any }) {
  const batches: Batch[] = data.batches || [];
  const pending = batches.filter((b) => b.organic_claim_status === 'pending_attestation');
  const attested = batches.filter((b) => b.organic_claim_status === 'attested');
  const certs: any[] = data.certs || [];
  const activeCerts = certs.filter((c: any) => c.status === 'active');

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">Awaiting Attestation</div><div className={`stat-value ${pending.length > 0 ? 'text-yellow-400' : 'text-brand-400'}`}>{pending.length}</div></div>
        <div className="stat-card"><div className="stat-label">Attested</div><div className="stat-value text-brand-400">{attested.length}</div></div>
        <div className="stat-card"><div className="stat-label">Active Certs</div><div className="stat-value text-brand-400">{activeCerts.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <ActionWidget icon="📋" title="Pending Batches" count={pending.length} label={pending.length > 0 ? 'Review batches' : 'No pending'} onClick={() => navigate('/batches')} urgent={pending.length > 0} />
        <ActionWidget icon="📜" title="Issue Certificate" count={0} label="Issue new certificate" onClick={() => navigate('/certs')} />
        <ActionWidget icon="🔗" title="Audit Events" count={0} label="View audit log" onClick={() => navigate('/audit')} />
      </div>
    </>
  );
}

function ImporterDash({ data, navigate }: { data: any; navigate: any }) {
  const listingsArr: Listing[] = data.listings || [];
  const contracts: Contract[] = data.contracts || [];
  const offers: Offer[] = data.offers || [];
  const myOffers = offers.filter((o) => o.status === 'pending');
  const inTransit = contracts.filter((c) => c.status === 'in_transit');

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">Available Listings</div><div className="stat-value">{listingsArr.length}</div></div>
        <div className="stat-card"><div className="stat-label">My Contracts</div><div className="stat-value">{contracts.length}</div></div>
        <div className="stat-card"><div className="stat-label">In Transit</div><div className="stat-value text-yellow-400">{inTransit.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <ActionWidget icon="🏪" title="Marketplace" count={listingsArr.length} label="Browse listings" onClick={() => navigate('/marketplace')} />
        <ActionWidget icon="📨" title="My Offers" count={myOffers.length} label="View offer status" onClick={() => navigate('/offers')} />
        <ActionWidget icon="🚢" title="Incoming Shipments" count={inTransit.length} label="Track shipments" onClick={() => navigate('/shipments')} urgent={inTransit.length > 0} />
      </div>
    </>
  );
}

function LogisticsDash({ data, navigate }: { data: any; navigate: any }) {
  const shipments: Shipment[] = data.shipments || [];
  const active = shipments.filter((s) => s.current_milestone !== 'delivered');
  const delivered = shipments.filter((s) => s.current_milestone === 'delivered');
  const accepted = shipments.filter((s) => s.current_milestone === 'accepted');
  const atPort = shipments.filter((s) => ['port_received', 'loaded'].includes(s.current_milestone));

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">Active</div><div className="stat-value">{active.length}</div></div>
        <div className="stat-card"><div className="stat-label">Accepted</div><div className="stat-value text-yellow-400">{accepted.length}</div></div>
        <div className="stat-card"><div className="stat-label">At Port</div><div className="stat-value">{atPort.length}</div></div>
        <div className="stat-card"><div className="stat-label">Delivered</div><div className="stat-value text-brand-400">{delivered.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <ActionWidget icon="🚢" title="Ready to Pick Up" count={accepted.length} label="Record pickup" onClick={() => navigate('/shipments')} urgent={accepted.length > 0} />
        <ActionWidget icon="⚓" title="At Port / Loading" count={atPort.length} label="Update milestones" onClick={() => navigate('/shipments')} urgent={atPort.length > 0} />
        <ActionWidget icon="✅" title="New Requests" count={0} label="View shipments" onClick={() => navigate('/shipments')} />
      </div>
    </>
  );
}

function RegulatorDash({ data, navigate }: { data: any; navigate: any }) {
  const audit: AuditEvent[] = data.audit || [];
  const certs: any[] = data.certs || [];
  const activeCerts = certs.filter((c: any) => c.status === 'active');

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="stat-card stat-card-accent"><div className="stat-label">Audit Events</div><div className="stat-value">{audit.length}</div></div>
        <div className="stat-card"><div className="stat-label">Risk Flags</div><div className="stat-value text-yellow-400">3</div></div>
        <div className="stat-card"><div className="stat-label">Active Certs</div><div className="stat-value text-brand-400">{activeCerts.length}</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <ActionWidget icon="🔗" title="Full Audit Log" count={audit.length} label="Review events" onClick={() => navigate('/audit')} />
        <ActionWidget icon="📋" title="Certificates" count={0} label="Browse certificates" onClick={() => navigate('/certs')} />
        <ActionWidget icon="🏡" title="Farm Registry" count={0} label="View farms" onClick={() => navigate('/farms')} />
      </div>

      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 mb-3 text-xs text-yellow-400">⚠ 3 farms in Brong-Ahafo region have no COCOBOD traceability ID</div>
      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 text-xs text-yellow-400">⚠ Certificate OC-GH-2248 expires in 12 days</div>
    </>
  );
}
