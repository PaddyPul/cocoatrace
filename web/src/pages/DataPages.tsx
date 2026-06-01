import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farms as farmsApi, batches as batchesApi, contracts as contractsApi, shipments as shipmentsApi, holdings as holdingsApi, payments as paymentsApi, evidence as evidenceApi, audit as auditApi, certificates as certApi, farms as farmsApi2 } from '../api';
import { Farm, Batch, Contract, Shipment, Holding, Payment, Evidence, AuditEvent, Certificate } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { Search, X } from 'lucide-react';

function useFetch<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const doFetch = () => {
    setLoading(true); setError('');
    return fetcher().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { doFetch(); }, []);
  return { data, loading, error, refetch: doFetch };
}

function Loading() { return <div className="loading"><div className="spinner" /><div>Loading…</div></div>; }
function Err({ msg }: { msg: string }) { return <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{msg}</div>; }

export function FarmsPage() {
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => farmsApi.list());
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [cfName, setCfName] = useState('');
  const [cfRegion, setCfRegion] = useState('');
  const [cfDistrict, setCfDistrict] = useState('');
  const [cfCommunity, setCfCommunity] = useState('');
  const [cfTraceId, setCfTraceId] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [createdFarmId, setCreatedFarmId] = useState<string | null>(null);
  const filtered = (data as Farm[]).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.region.toLowerCase().includes(search.toLowerCase()) || f.country.toLowerCase().includes(search.toLowerCase()) || f.district.toLowerCase().includes(search.toLowerCase()) || (f.official_traceability_id || '').toLowerCase().includes(search.toLowerCase()));

  // Plot creation
  const [showPlot, setShowPlot] = useState(false);
  const [plotCode, setPlotCode] = useState('');
  const [plotArea, setPlotArea] = useState(0);
  const [plotCrops, setPlotCrops] = useState('cocoa');
  const [plotGpsLat, setPlotGpsLat] = useState('');
  const [plotGpsLng, setPlotGpsLng] = useState('');
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState('');

  const handleCreateFarm = async () => {
    if (!cfName || !cfRegion || !cfDistrict) { setCfError('Name, region, and district required'); return; }
    setCfLoading(true); setCfError('');
    try {
      const farm = await farmsApi.create({ name: cfName, region: cfRegion, district: cfDistrict, community: cfCommunity || undefined, officialTraceabilityId: cfTraceId || undefined });
      setShowCreate(false); setCfName(''); setCfRegion(''); setCfDistrict(''); setCfCommunity(''); setCfTraceId('');
      setCreatedFarmId(farm.id);
      refetch();
      toast('success', 'Farm created successfully');
    } catch (e: any) { setCfError(e.message); } finally { setCfLoading(false); }
  };

  const handleCreatePlot = async () => {
    if (!createdFarmId || !plotCode || !plotArea) { setPlotError('Plot code and area required'); return; }
    setPlotLoading(true); setPlotError('');
    try {
      await farmsApi.createPlot(createdFarmId, { plotCode, areaHectares: Number(plotArea), crops: plotCrops.split(',').map((s) => s.trim()), gpsLat: plotGpsLat ? Number(plotGpsLat) : undefined, gpsLng: plotGpsLng ? Number(plotGpsLng) : undefined });
      setShowPlot(false); setPlotCode(''); setPlotArea(0); setPlotCrops('cocoa'); setPlotGpsLat(''); setPlotGpsLng('');
      setCreatedFarmId(null);
      toast('success', 'Plot added to farm');
    } catch (e: any) { setPlotError(e.message); } finally { setPlotLoading(false); }
  };

  return <Layout currentPage="farms">
    {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Search farms…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-xs text-text-muted">{filtered.length} farm{filtered.length !== 1 ? 's' : ''}</div>
        {canDo('farm.create') && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Farm</button>}
      </div>
      <table><thead><tr><th>Name</th><th>Region</th><th>Country</th><th>District</th><th>COCOBOD ID</th><th>Status</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((f) => <tr key={f.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/farms/${f.id}`)}><td className="text-text-primary font-medium">{f.name}</td><td>{f.region}</td><td>{f.country}</td><td>{f.district}</td><td className="font-mono text-[11px]">{f.official_traceability_id || '—'}</td><td><StatusBadge status={f.verification_status} /></td></tr>) : (data as Farm[]).length === 0 ? <tr><td colSpan={99}><EmptyState icon="🏡" title="No farms registered" description="Register your first farm to start tracing cocoa from plot to port." action={canDo('farm.create') ? <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Farm</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No farms match" description="Try adjusting your search." /></td></tr>}</tbody></table></div>}

    {showCreate && (
      <div className="modal-overlay" onClick={() => !cfLoading && setShowCreate(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">Create Farm</div></div>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
          </div>
          <div className="space-y-3">
            <input className="form-input" placeholder="Farm name *" value={cfName} onChange={(e) => setCfName(e.target.value)} />
            <input className="form-input" placeholder="Region *" value={cfRegion} onChange={(e) => setCfRegion(e.target.value)} />
            <input className="form-input" placeholder="District *" value={cfDistrict} onChange={(e) => setCfDistrict(e.target.value)} />
            <input className="form-input" placeholder="Community" value={cfCommunity} onChange={(e) => setCfCommunity(e.target.value)} />
            <input className="form-input" placeholder="COCOBOD ID" value={cfTraceId} onChange={(e) => setCfTraceId(e.target.value)} />
            {cfError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{cfError}</div>}
            <div className="flex gap-2 pt-1">
              <button className="btn flex-1 justify-center" onClick={() => setShowCreate(false)} disabled={cfLoading}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={handleCreateFarm} disabled={cfLoading}>
                {cfLoading ? 'Creating…' : 'Create Farm'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {createdFarmId && !showPlot && (
      <div className="modal-overlay" onClick={() => setCreatedFarmId(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🌱</div>
            <div className="text-lg font-semibold text-brand-400 mb-1">Farm Created!</div>
            <p className="text-xs text-text-muted mb-5">Add plots to register the growing areas for this farm.</p>
            <div className="flex gap-2 justify-center">
              <button className="btn" onClick={() => setCreatedFarmId(null)}>Skip</button>
              <button className="btn btn-primary" onClick={() => { setShowPlot(true); }}>+ Add Plot</button>
              <button className="btn" onClick={() => { navigate(`/farms/${createdFarmId}`); }}>View Farm</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showPlot && createdFarmId && (
      <div className="modal-overlay" onClick={() => !plotLoading && setShowPlot(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">Add Plot</div></div>
            <button className="btn btn-sm" onClick={() => setShowPlot(false)}><X size={14} /></button>
          </div>
          <div className="space-y-3">
            <input className="form-input" placeholder="Plot code * (e.g. PLOT-A-01)" value={plotCode} onChange={(e) => setPlotCode(e.target.value)} />
            <input type="number" step="0.01" className="form-input" placeholder="Area (hectares) *" value={plotArea || ''} onChange={(e) => setPlotArea(Number(e.target.value))} />
            <input className="form-input" placeholder="Crops (comma-separated, default: cocoa)" value={plotCrops} onChange={(e) => setPlotCrops(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="any" className="form-input" placeholder="GPS Lat" value={plotGpsLat} onChange={(e) => setPlotGpsLat(e.target.value)} />
              <input type="number" step="any" className="form-input" placeholder="GPS Lng" value={plotGpsLng} onChange={(e) => setPlotGpsLng(e.target.value)} />
            </div>
            {plotError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{plotError}</div>}
            <div className="flex gap-2 pt-1">
              <button className="btn flex-1 justify-center" onClick={() => { setShowPlot(false); setCreatedFarmId(null); }} disabled={plotLoading}>Skip</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={handleCreatePlot} disabled={plotLoading || !plotCode || !plotArea}>
                {plotLoading ? 'Creating…' : 'Add Plot'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Layout>;
}

export function BatchesPage() {
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => batchesApi.list());
  const [search, setSearch] = useState('');
  const batches = data as Batch[];
  const filtered = batches.filter((b) => !search || b.farm_name?.toLowerCase().includes(search.toLowerCase()) || b.grade?.toLowerCase().includes(search.toLowerCase()) || b.crop?.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase()) || b.organic_claim_status.toLowerCase().includes(search.toLowerCase()));
  const farmsFetch = useFetch(() => farmsApi.list());
  const userFarms = (farmsFetch.data || []) as Farm[];

  // Create batch modal
  const [showCreate, setShowCreate] = useState(false);
  const [cbFarmId, setCbFarmId] = useState('');
  const [cbCrop, setCbCrop] = useState('cocoa');
  const [cbHarvestDate, setCbHarvestDate] = useState('');
  const [cbQty, setCbQty] = useState(0);
  const [cbMoisture, setCbMoisture] = useState('');
  const [cbGrade, setCbGrade] = useState('');
  const [cbLoading, setCbLoading] = useState(false);
  const [cbError, setCbError] = useState('');
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);

  const handleCreateBatch = async () => {
    if (!cbFarmId || !cbHarvestDate || !cbQty || cbQty <= 0) { setCbError('Farm, harvest date, and quantity required'); return; }
    setCbLoading(true); setCbError('');
    try {
      const batch = await batchesApi.create({
        farmId: cbFarmId, crop: cbCrop, harvestDate: cbHarvestDate,
        quantityKg: Number(cbQty), moisturePercent: cbMoisture ? Number(cbMoisture) : undefined,
        grade: cbGrade || undefined,
      });
      setShowCreate(false); setCbFarmId(''); setCbHarvestDate(''); setCbQty(0); setCbMoisture(''); setCbGrade('');
      setCreatedBatchId(batch.id);
      refetch();
      toast('success', 'Batch created successfully');
    } catch (e: any) { setCbError(e.message); } finally { setCbLoading(false); }
  };

  return <Layout currentPage="batches">
    {loading ? <SkeletonTable rows={5} cols={7} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Search batches…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-xs text-text-muted">{filtered.length} batch{filtered.length !== 1 ? 'es' : ''}</div>
        {canDo('batch.create') && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Batch</button>}
      </div>
      <table><thead><tr><th>Batch ID</th><th>Farm</th><th>Harvest Date</th><th>Qty (kg)</th><th>Grade</th><th>Status</th><th></th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((b) => <tr key={b.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/batches/${b.id}`)}><td className="font-mono text-[11px]">{b.id.slice(0, 13)}…</td><td className="text-text-primary font-medium">{b.farm_name || '—'}</td><td>{fmtDate(b.harvest_date)}</td><td>{(b.quantity_kg || 0).toLocaleString()}</td><td>{b.grade || '—'}</td><td><StatusBadge status={b.organic_claim_status} /></td><td>{b.current_holder_id === user?.organizationId && canDo('batch.create') ? <span className="badge badge-green font-mono text-[10px]">You hold this</span> : <span className="text-text-muted text-[10px]">Details →</span>}</td></tr>) : batches.length === 0 ? <tr><td colSpan={99}><EmptyState icon="📦" title="No batches yet" description="Create a batch after harvesting to begin the traceability chain." action={canDo('batch.create') ? <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Batch</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No batches match" description="Try adjusting your search." /></td></tr>}</tbody></table></div>}

    {/* Create Batch Modal */}
    {showCreate && (
      <div className="modal-overlay" onClick={() => !cbLoading && setShowCreate(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">Create Batch</div></div>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
          </div>
          <div className="space-y-3">
            <select className="form-select" value={cbFarmId} onChange={(e) => setCbFarmId(e.target.value)}>
              <option value="">Select farm *</option>
              {userFarms.filter((f) => f.farmer_organization_id === user?.organizationId).map((f) => (
                <option key={f.id} value={f.id}>{f.name} — {f.region}</option>
              ))}
            </select>
            <input type="date" className="form-input" value={cbHarvestDate} onChange={(e) => setCbHarvestDate(e.target.value)} />
            <input type="number" className="form-input" placeholder="Quantity (kg) *" value={cbQty || ''} onChange={(e) => setCbQty(Number(e.target.value))} />
            <input className="form-input" placeholder="Crop (default: cocoa)" value={cbCrop} onChange={(e) => setCbCrop(e.target.value)} />
            <input type="number" step="0.1" className="form-input" placeholder="Moisture %" value={cbMoisture} onChange={(e) => setCbMoisture(e.target.value)} />
            <input className="form-input" placeholder="Grade (e.g. Grade A)" value={cbGrade} onChange={(e) => setCbGrade(e.target.value)} />
            {cbError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{cbError}</div>}
            <div className="flex gap-2 pt-1">
              <button className="btn flex-1 justify-center" onClick={() => setShowCreate(false)} disabled={cbLoading}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={handleCreateBatch} disabled={cbLoading}>
                {cbLoading ? 'Creating…' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {createdBatchId && (
      <div className="modal-overlay" onClick={() => setCreatedBatchId(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-6">
            <div className="text-3xl mb-3">📦</div>
            <div className="text-lg font-semibold text-brand-400 mb-1">Batch Created!</div>
            <p className="text-xs text-text-muted mb-5">You can now list this batch on the marketplace for buyers.</p>
            <div className="flex gap-2 justify-center">
              <button className="btn" onClick={() => setCreatedBatchId(null)}>Done</button>
              <button className="btn btn-primary" onClick={() => { setCreatedBatchId(null); navigate(`/batches/${createdBatchId}`); }}>List on Marketplace →</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Layout>;
}

export function HoldingsPage() {
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => holdingsApi.list());
  const [search, setSearch] = useState('');
  const holdings = data as Holding[];

  // Create holding
  const [showCreate, setShowCreate] = useState(false);
  const [chBatchId, setChBatchId] = useState('');
  const [chQty, setChQty] = useState(0);
  const [chWarehouse, setChWarehouse] = useState('');
  const [chLoading, setChLoading] = useState(false);
  const [chError, setChError] = useState('');

  const handleCreateHolding = async () => {
    if (!chBatchId || !chQty) { setChError('Batch ID and quantity required'); return; }
    setChLoading(true); setChError('');
    try {
      await holdingsApi.create({ batchId: chBatchId, quantityKg: Number(chQty), warehouseLocation: chWarehouse || undefined });
      setShowCreate(false); setChBatchId(''); setChQty(0); setChWarehouse('');
      refetch();
      toast('success', 'Holding created');
    } catch (e: any) { setChError(e.message); } finally { setChLoading(false); }
  };

  const filtered = holdings.filter((h) => !search || h.farm_name?.toLowerCase().includes(search.toLowerCase()) || h.crop?.toLowerCase().includes(search.toLowerCase()) || (h.warehouse_location || '').toLowerCase().includes(search.toLowerCase()) || h.status.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="holdings">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search holdings…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} holding{filtered.length !== 1 ? 's' : ''}</div>
      {canDo('holding.create') && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Holding</button>}
    </div>
    <table><thead><tr><th>ID</th><th>Farm</th><th>Crop</th><th>Qty (kg)</th><th>Warehouse</th><th>Status</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((h) => <tr key={h.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/holdings/${h.id}`)}><td className="font-mono text-[11px]">{h.id.slice(0, 13)}…</td><td className="text-text-primary font-medium">{h.farm_name || '—'}</td><td>{h.crop || 'cocoa'}</td><td>{(h.quantity_kg || 0).toLocaleString()}</td><td className="text-[11px]">{h.warehouse_location || '—'}</td><td><StatusBadge status={h.status} /></td></tr>) : holdings.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🏪" title="No holdings yet" description="Holdings represent batch inventory in your custody. They appear when batches are created or transferred to your organization." action={canDo('holding.create') ? <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Holding</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No holdings match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}

  {showCreate && (
    <div className="modal-overlay" onClick={() => !chLoading && setShowCreate(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div><div className="modal-title">Create Holding</div></div>
          <button className="btn btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <input className="form-input" placeholder="Batch ID *" value={chBatchId} onChange={(e) => setChBatchId(e.target.value)} />
          <input type="number" className="form-input" placeholder="Quantity (kg) *" value={chQty || ''} onChange={(e) => setChQty(Number(e.target.value))} />
          <input className="form-input" placeholder="Warehouse location" value={chWarehouse} onChange={(e) => setChWarehouse(e.target.value)} />
          {chError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{chError}</div>}
          <div className="flex gap-2 pt-1">
            <button className="btn flex-1 justify-center" onClick={() => setShowCreate(false)} disabled={chLoading}>Cancel</button>
            <button className="btn btn-primary flex-1 justify-center" onClick={handleCreateHolding} disabled={chLoading || !chBatchId || !chQty}>
              {chLoading ? 'Creating…' : 'Create Holding'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
  </Layout>;
}

export function ContractsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => contractsApi.list());
  const [search, setSearch] = useState('');
  const contracts = data as Contract[];
  const filtered = contracts.filter((c) => !search || c.seller_name?.toLowerCase().includes(search.toLowerCase()) || c.buyer_name?.toLowerCase().includes(search.toLowerCase()) || c.incoterm.toLowerCase().includes(search.toLowerCase()) || c.status.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="contracts">{loading ? <SkeletonTable rows={5} cols={7} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search contracts…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} contract{filtered.length !== 1 ? 's' : ''}</div>
    </div>
    <table><thead><tr><th>Contract</th><th>Seller</th><th>Buyer</th><th>Qty (kg)</th><th>Value</th><th>Incoterm</th><th>Status</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/contracts/${c.id}`)}><td className="font-mono text-[11px]">{c.id.slice(0, 8)}…</td><td>{c.seller_name || '—'}</td><td className="text-text-primary font-medium">{c.buyer_name || '—'}</td><td>{(c.quantity_kg || 0).toLocaleString()}</td><td className="text-brand-400">€{Math.round(c.quantity_kg * c.price_per_kg).toLocaleString()}</td><td className="font-mono text-[11px]">{c.incoterm}</td><td><StatusBadge status={c.status} /></td></tr>) : contracts.length === 0 ? <tr><td colSpan={99}><EmptyState icon="📄" title="No contracts yet" description="Contracts are created automatically when a seller accepts an offer on the marketplace." action={<button className="btn btn-sm" onClick={() => navigate('/marketplace')}>Browse Marketplace →</button>} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No contracts match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export function ShipmentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => shipmentsApi.list());
  const [search, setSearch] = useState('');
  const shipments = data as Shipment[];
  const filtered = shipments.filter((s) => !search || (s.vessel_name || '').toLowerCase().includes(search.toLowerCase()) || (s.container_reference || '').toLowerCase().includes(search.toLowerCase()) || s.origin_port.toLowerCase().includes(search.toLowerCase()) || s.destination_port.toLowerCase().includes(search.toLowerCase()) || s.current_milestone.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="shipments">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search shipments…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} shipment{filtered.length !== 1 ? 's' : ''}</div>
    </div>
    <table><thead><tr><th>Vessel</th><th>Container</th><th>Route</th><th>ETA</th><th>B/L</th><th>Milestone</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((s) => <tr key={s.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/shipments/${s.id}`)}><td className="text-text-primary font-medium">{s.vessel_name || 'Shipment'}</td><td className="font-mono text-[11px]">{s.container_reference || '—'}</td><td className="text-[11px]">{s.origin_port} → {s.destination_port}</td><td>{fmtDate(s.eta_arrival)}</td><td className="font-mono text-[11px]">{s.bill_of_lading_number || '—'}</td><td><StatusBadge status={s.current_milestone} /></td></tr>) : shipments.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🚢" title="No shipments yet" description="Shipments are created when a seller requests logistics for a contract." /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No shipments match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => paymentsApi.list());
  const [search, setSearch] = useState('');
  const payments = data as Payment[];
  const filtered = payments.filter((p) => !search || p.status.toLowerCase().includes(search.toLowerCase()) || p.currency.toLowerCase().includes(search.toLowerCase()) || (p.payment_reference_external || '').toLowerCase().includes(search.toLowerCase()) || p.contract_id.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="payments">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search payments…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} payment{filtered.length !== 1 ? 's' : ''}</div>
    </div>
    <table><thead><tr><th>Payment ID</th><th>Contract</th><th>Amount</th><th>Currency</th><th>Status</th><th>Reference</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/payments/${p.id}`)}><td className="font-mono text-[11px]">{p.id.slice(0, 8)}…</td><td className="font-mono text-[11px]">{p.contract_id.slice(0, 8)}…</td><td className="text-brand-400 font-mono">{fmtMoney(p.amount_total, p.currency)}</td><td>{p.currency}</td><td><StatusBadge status={p.status} /></td><td className="font-mono text-[10px]">{p.payment_reference_external || '—'}</td></tr>) : payments.length === 0 ? <tr><td colSpan={99}><EmptyState icon="💰" title="No payments yet" description="Payment requests appear when a seller requests payment for a contract." /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No payments match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export function EvidencePage() {
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => evidenceApi.list());
  const [search, setSearch] = useState('');
  const evs = data as Evidence[];

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upType, setUpType] = useState('');
  const [upLinkedType, setUpLinkedType] = useState('batch');
  const [upLinkedId, setUpLinkedId] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upLoading, setUpLoading] = useState(false);
  const [upError, setUpError] = useState('');

  const handleUpload = async () => {
    if (!upFile || !upLinkedId) { setUpError('File and linked entity ID required'); return; }
    setUpLoading(true); setUpError('');
    try {
      await evidenceApi.upload(upFile, { type: upType || undefined, linkedEntityType: upLinkedType, linkedEntityId: upLinkedId, claimDescription: upDesc || undefined });
      setShowUpload(false); setUpFile(null); setUpType(''); setUpLinkedId(''); setUpDesc('');
      refetch();
      toast('success', 'Evidence uploaded');
    } catch (e: any) { setUpError(e.message); } finally { setUpLoading(false); }
  };

  const filtered = evs.filter((e) => !search || e.file_name.toLowerCase().includes(search.toLowerCase()) || (e.type || '').toLowerCase().includes(search.toLowerCase()) || e.linked_entity_type.toLowerCase().includes(search.toLowerCase()) || (e.review_status || '').toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="evidence">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search evidence…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</div>
      {canDo('evidence.upload') && <button className="btn btn-sm btn-primary" onClick={() => setShowUpload(true)}>+ Upload</button>}
    </div>
    <table><thead><tr><th>File</th><th>Type</th><th>SHA-256</th><th>Linked Entity</th><th>Status</th><th>Uploaded</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((e) => <tr key={e.id} className="hover:bg-brand-500/5"><td className="text-text-primary font-medium">{e.file_name}</td><td>{(e.type || '').replace(/_/g, ' ')}</td><td className="font-mono text-[10px] max-w-[200px] truncate">{e.sha256_hash}</td><td className="font-mono text-[10px]">{e.linked_entity_type}/{e.linked_entity_id.slice(0, 8)}…</td><td><StatusBadge status={e.review_status} /></td><td className="text-[11px]">{fmtDate(e.created_at)}</td></tr>) : evs.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🗂" title="No evidence uploaded" description="Evidence documents support traceability claims and certification audits." action={canDo('evidence.upload') ? <button className="btn btn-sm btn-primary" onClick={() => setShowUpload(true)}>+ Upload Evidence</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No evidence match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}

  {showUpload && (
    <div className="modal-overlay" onClick={() => !upLoading && setShowUpload(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div><div className="modal-title">Upload Evidence</div></div>
          <button className="btn btn-sm" onClick={() => setShowUpload(false)}><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="form-label">File *</label>
            <input type="file" className="form-input" onChange={(e) => setUpFile(e.target.files?.[0] || null)} />
          </div>
          <input className="form-input" placeholder="Type (e.g. certificate_pdf, weighing_ticket)" value={upType} onChange={(e) => setUpType(e.target.value)} />
          <select className="form-select" value={upLinkedType} onChange={(e) => setUpLinkedType(e.target.value)}>
            <option value="batch">Batch</option><option value="shipment">Shipment</option><option value="farm">Farm</option><option value="certificate">Certificate</option>
          </select>
          <input className="form-input" placeholder="Linked Entity ID *" value={upLinkedId} onChange={(e) => setUpLinkedId(e.target.value)} />
          <textarea className="form-input" rows={2} placeholder="Description (optional)" value={upDesc} onChange={(e) => setUpDesc(e.target.value)} />
          {upError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{upError}</div>}
          <div className="flex gap-2 pt-1">
            <button className="btn flex-1 justify-center" onClick={() => setShowUpload(false)} disabled={upLoading}>Cancel</button>
            <button className="btn btn-primary flex-1 justify-center" onClick={handleUpload} disabled={upLoading || !upFile || !upLinkedId}>
              {upLoading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
  </Layout>;
}

const AUDIT_ENTITY_ROUTES: Record<string, string> = {
  harvest_batch: '/batches',
  sales_contract: '/contracts',
  shipment: '/shipments',
  payment_request: '/payments',
  trade_offer: '/contracts',
  listing: '/marketplace',
  organic_certificate: '/certs',
  farm: '/farms',
  batch_holding: '/holdings',
  custody_transfer: '/holdings',
  evidence_item: '/evidence',
};

export function AuditPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => auditApi.list());
  const [search, setSearch] = useState('');
  const events = data as AuditEvent[];
  const filtered = events.filter((a) => !search || a.action.toLowerCase().includes(search.toLowerCase()) || a.entity_type.toLowerCase().includes(search.toLowerCase()) || a.entity_id.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="audit">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search audit log…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</div>
    </div>
    <table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Hash</th><th></th></tr></thead><tbody>{filtered.map((a) => {
    const route = AUDIT_ENTITY_ROUTES[a.entity_type];
    return <tr key={a.id} className="hover:bg-brand-500/5">
      <td className="font-mono text-[10px] whitespace-nowrap">{new Date(a.occurred_at).toLocaleString()}</td>
      <td><span className="badge badge-blue">{a.action}</span></td>
      <td className="font-mono text-[10px]">{a.entity_type}/{a.entity_id.slice(0, 8)}</td>
      <td className="text-[11px]">{a.actor_user_id.slice(0, 8)}…</td>
      <td className="font-mono text-[10px]">{(a.new_state_hash || '').slice(0, 20)}…</td>
      <td>{route ? <button className="btn btn-sm text-[10px]" onClick={() => navigate(`${route}`)}>View →</button> : <span className="text-text-muted">—</span>}</td>
    </tr>;
  })}{events.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🔗" title="No audit events" description="Audit events are recorded automatically for all platform actions." /></td></tr> : filtered.length === 0 && <tr><td colSpan={99}><EmptyState icon="🔍" title="No events match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export function CertsPage() {
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => certApi.list());
  const farms = useFetch(() => farmsApi2.list());
  const [search, setSearch] = useState('');
  const certs = data as Certificate[];
  const filtered = certs.filter((c) => !search || c.standard.toLowerCase().includes(search.toLowerCase()) || c.status.toLowerCase().includes(search.toLowerCase()) || (c.certifier_name || '').toLowerCase().includes(search.toLowerCase()));

  // Issue modal
  const [showIssue, setShowIssue] = useState(false);
  const [ifarmId, setIfarmId] = useState('');
  const [iStandard, setIStandard] = useState('EU_ORGANIC');
  const [iCropScope, setICropScope] = useState('cocoa');
  const [iValidFrom, setIValidFrom] = useState('');
  const [iValidTo, setIValidTo] = useState('');
  const [iAuthority, setIAuthority] = useState('');
  const [iAccred, setIAccred] = useState('');
  const [iLoading, setILoading] = useState(false);
  const [iError, setIError] = useState('');

  const handleIssue = async () => {
    if (!ifarmId || !iValidFrom || !iValidTo || !iAuthority || !iAccred) { setIError('All fields required'); return; }
    setILoading(true); setIError('');
    try {
      const targetFarm = (farms.data as Farm[]).find((f) => f.id === ifarmId);
      await certApi.issue({
        farmerOrganizationId: targetFarm?.farmer_organization_id || '',
        farmId: ifarmId, standard: iStandard,
        cropScope: iCropScope.split(',').map((s) => s.trim()),
        validFrom: iValidFrom, validTo: iValidTo,
        issuingAuthority: iAuthority, accreditationReference: iAccred,
      });
      setShowIssue(false); setIfarmId(''); setIValidFrom(''); setIValidTo(''); setIAuthority(''); setIAccred('');
      refetch();
      toast('success', 'Certificate issued');
    } catch (e: any) { setIError(e.message); } finally { setILoading(false); }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await certApi.updateStatus(id, action);
      refetch();
      toast('success', `Certificate ${action}ed`);
    } catch (e: any) { toast('error', e.message); }
  };

  return <Layout currentPage="certs">
    {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Search certificates…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-xs text-text-muted">{filtered.length} certificate{filtered.length !== 1 ? 's' : ''}</div>
        {canDo('certificate.issue') && <button className="btn btn-sm btn-primary" onClick={() => setShowIssue(true)}>+ Issue Certificate</button>}
      </div>
      <table><thead><tr><th>Standard</th><th>Certifier</th><th>Farm</th><th>Valid From</th><th>Valid To</th><th>Status</th><th></th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((c) => <tr key={c.id} className="hover:bg-brand-500/5">
        <td className="text-text-primary font-medium">{c.standard}</td><td>{c.certifier_name || '—'}</td><td className="font-mono text-[11px]">{c.farm_id.slice(0, 8)}…</td><td className="text-[11px]">{fmtDate(c.valid_from)}</td><td className="text-[11px]">{fmtDate(c.valid_to)}</td><td><StatusBadge status={c.status} /></td>
        <td>{canDo('certificate.issue') && c.status === 'active' ? <div className="flex gap-1">
          <button className="btn btn-sm text-[10px] text-yellow-400 border-yellow-500/30" onClick={() => handleAction(c.id, 'suspend')}>Suspend</button>
          <button className="btn btn-sm text-[10px] text-red-400 border-red-500/30" onClick={() => handleAction(c.id, 'revoke')}>Revoke</button>
        </div> : canDo('certificate.issue') && c.status === 'suspended' ? <button className="btn btn-sm text-[10px] text-green-400 border-green-500/30" onClick={() => handleAction(c.id, 'reinstate')}>Reinstate</button> : <button className="btn btn-sm text-[10px]" onClick={() => navigate(`/farms/${c.farm_id}`)}>View Farm</button>}</td>
      </tr>) : certs.length === 0 ? <tr><td colSpan={99}><EmptyState icon="📋" title="No certificates" description="Certificates are issued by accredited certifiers to verified farms." action={canDo('certificate.issue') ? <button className="btn btn-sm btn-primary" onClick={() => setShowIssue(true)}>+ Issue Certificate</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No certificates match" description="Try adjusting your search." /></td></tr>}</tbody></table>
    </div>}

    {/* Issue Certificate Modal */}
    {showIssue && (
      <div className="modal-overlay" onClick={() => !iLoading && setShowIssue(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">Issue Certificate</div></div>
            <button className="btn btn-sm" onClick={() => setShowIssue(false)}><X size={14} /></button>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="form-label">Farm *</label>
              <select className="form-select" value={ifarmId} onChange={(e) => setIfarmId(e.target.value)}>
                <option value="">Select farm…</option>
                {(farms.data as Farm[]).map((f) => <option key={f.id} value={f.id}>{f.name} — {f.region}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Standard</label>
              <select className="form-select" value={iStandard} onChange={(e) => setIStandard(e.target.value)}>
                <option value="EU_ORGANIC">EU Organic</option>
                <option value="USDA_ORGANIC">USDA Organic</option>
                <option value="RAINFOREST_ALLIANCE">Rainforest Alliance</option>
                <option value="FAIRTRADE">Fairtrade</option>
                <option value="UTZ">UTZ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Crop Scope</label>
              <input className="form-input" placeholder="cocoa, coffee…" value={iCropScope} onChange={(e) => setICropScope(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Valid From *</label>
                <input type="date" className="form-input" value={iValidFrom} onChange={(e) => setIValidFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Valid To *</label>
                <input type="date" className="form-input" value={iValidTo} onChange={(e) => setIValidTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Issuing Authority *</label>
              <input className="form-input" placeholder="e.g. OrganicCert GH" value={iAuthority} onChange={(e) => setIAuthority(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Accreditation Reference *</label>
              <input className="form-input" placeholder="e.g. ACC-GH-2024-001" value={iAccred} onChange={(e) => setIAccred(e.target.value)} />
            </div>
            {iError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{iError}</div>}
            <div className="flex gap-2 pt-1">
              <button className="btn flex-1 justify-center" onClick={() => setShowIssue(false)} disabled={iLoading}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={handleIssue} disabled={iLoading}>{iLoading ? 'Issuing…' : 'Issue Certificate'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Layout>;
}
