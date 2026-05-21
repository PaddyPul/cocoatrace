import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farms as farmsApi, batches as batchesApi, contracts as contractsApi, shipments as shipmentsApi, holdings as holdingsApi, payments as paymentsApi, evidence as evidenceApi, audit as auditApi } from '../api';
import { Farm, Batch, Contract, Shipment, Holding, Payment, Evidence, AuditEvent } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import { X } from 'lucide-react';

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
function Empty() { return <tr><td colSpan={99} className="text-center py-8 text-text-muted">No data</td></tr>; }

export function FarmsPage() {
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { data, loading, error, refetch } = useFetch(() => farmsApi.list());
  const [showCreate, setShowCreate] = useState(false);
  const [cfName, setCfName] = useState('');
  const [cfRegion, setCfRegion] = useState('');
  const [cfDistrict, setCfDistrict] = useState('');
  const [cfCommunity, setCfCommunity] = useState('');
  const [cfTraceId, setCfTraceId] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [createdFarmId, setCreatedFarmId] = useState<string | null>(null);

  // Plot creation
  const [showPlot, setShowPlot] = useState(false);
  const [plotCode, setPlotCode] = useState('');
  const [plotArea, setPlotArea] = useState(0);
  const [plotCrops, setPlotCrops] = useState('cocoa');
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
    } catch (e: any) { setCfError(e.message); } finally { setCfLoading(false); }
  };

  const handleCreatePlot = async () => {
    if (!createdFarmId || !plotCode || !plotArea) { setPlotError('Plot code and area required'); return; }
    setPlotLoading(true); setPlotError('');
    try {
      await farmsApi.createPlot(createdFarmId, { plotCode, areaHectares: Number(plotArea), crops: plotCrops.split(',').map((s) => s.trim()) });
      setShowPlot(false); setPlotCode(''); setPlotArea(0); setPlotCrops('cocoa');
      setCreatedFarmId(null);
    } catch (e: any) { setPlotError(e.message); } finally { setPlotLoading(false); }
  };

  return <Layout currentPage="farms">
    {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-text-muted">{data.length} farm{data.length !== 1 ? 's' : ''}</div>
        {canDo('farm.create') && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Farm</button>}
      </div>
      <table><thead><tr><th>Name</th><th>Region</th><th>Country</th><th>District</th><th>COCOBOD ID</th><th>Status</th></tr></thead><tbody>{(data as Farm[]).map((f) => <tr key={f.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/farms/${f.id}`)}><td className="text-text-primary font-medium">{f.name}</td><td>{f.region}</td><td>{f.country}</td><td>{f.district}</td><td className="font-mono text-[11px]">{f.official_traceability_id || '—'}</td><td><StatusBadge status={f.verification_status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}

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
  const { data, loading, error, refetch } = useFetch(() => batchesApi.list());
  const batches = data as Batch[];
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
    } catch (e: any) { setCbError(e.message); } finally { setCbLoading(false); }
  };

  return <Layout currentPage="batches">
    {loading ? <SkeletonTable rows={5} cols={7} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-text-muted">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</div>
        {canDo('batch.create') && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ Create Batch</button>}
      </div>
      <table><thead><tr><th>Batch ID</th><th>Farm</th><th>Harvest Date</th><th>Qty (kg)</th><th>Grade</th><th>Status</th><th></th></tr></thead><tbody>{batches.map((b) => <tr key={b.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/batches/${b.id}`)}><td className="font-mono text-[11px]">{b.id.slice(0, 13)}…</td><td className="text-text-primary font-medium">{b.farm_name || '—'}</td><td>{fmtDate(b.harvest_date)}</td><td>{(b.quantity_kg || 0).toLocaleString()}</td><td>{b.grade || '—'}</td><td><StatusBadge status={b.organic_claim_status} /></td><td>{b.current_holder_id === user?.organizationId && canDo('batch.create') ? <span className="badge badge-green font-mono text-[10px]">You hold this</span> : <span className="text-text-muted text-[10px]">Details →</span>}</td></tr>)}{batches.length === 0 && <Empty />}</tbody></table></div>}

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
  const { data, loading, error } = useFetch(() => holdingsApi.list());
  return <Layout currentPage="holdings">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Farm</th><th>Crop</th><th>Qty (kg)</th><th>Warehouse</th><th>Status</th></tr></thead><tbody>{(data as Holding[]).map((h) => <tr key={h.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/holdings/${h.id}`)}><td className="font-mono text-[11px]">{h.id.slice(0, 13)}…</td><td className="text-text-primary font-medium">{h.farm_name || '—'}</td><td>{h.crop || 'cocoa'}</td><td>{(h.quantity_kg || 0).toLocaleString()}</td><td className="text-[11px]">{h.warehouse_location || '—'}</td><td><StatusBadge status={h.status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function ContractsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => contractsApi.list());
  return <Layout currentPage="contracts">{loading ? <SkeletonTable rows={5} cols={7} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Contract</th><th>Seller</th><th>Buyer</th><th>Qty (kg)</th><th>Value</th><th>Incoterm</th><th>Status</th></tr></thead><tbody>{(data as Contract[]).map((c) => <tr key={c.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/contracts/${c.id}`)}><td className="font-mono text-[11px]">{c.id.slice(0, 8)}…</td><td>{c.seller_name || '—'}</td><td className="text-text-primary font-medium">{c.buyer_name || '—'}</td><td>{(c.quantity_kg || 0).toLocaleString()}</td><td className="text-brand-400">€{Math.round(c.quantity_kg * c.price_per_kg).toLocaleString()}</td><td className="font-mono text-[11px]">{c.incoterm}</td><td><StatusBadge status={c.status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function ShipmentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => shipmentsApi.list());
  return <Layout currentPage="shipments">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Vessel</th><th>Container</th><th>Route</th><th>ETA</th><th>B/L</th><th>Milestone</th></tr></thead><tbody>{(data as Shipment[]).map((s) => <tr key={s.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/shipments/${s.id}`)}><td className="text-text-primary font-medium">{s.vessel_name || 'Shipment'}</td><td className="font-mono text-[11px]">{s.container_reference || '—'}</td><td className="text-[11px]">{s.origin_port} → {s.destination_port}</td><td>{fmtDate(s.eta_arrival)}</td><td className="font-mono text-[11px]">{s.bill_of_lading_number || '—'}</td><td><StatusBadge status={s.current_milestone} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => paymentsApi.list());
  return <Layout currentPage="payments">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Payment ID</th><th>Contract</th><th>Amount</th><th>Currency</th><th>Status</th><th>Reference</th></tr></thead><tbody>{(data as Payment[]).map((p) => <tr key={p.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/payments/${p.id}`)}><td className="font-mono text-[11px]">{p.id.slice(0, 8)}…</td><td className="font-mono text-[11px]">{p.contract_id.slice(0, 8)}…</td><td className="text-brand-400 font-mono">{fmtMoney(p.amount_total, p.currency)}</td><td>{p.currency}</td><td><StatusBadge status={p.status} /></td><td className="font-mono text-[10px]">{p.payment_reference_external || '—'}</td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function EvidencePage() {
  const { data, loading, error } = useFetch(() => evidenceApi.list());
  return <Layout currentPage="evidence">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>File</th><th>Type</th><th>SHA-256</th><th>Linked Entity</th><th>Status</th><th>Uploaded</th></tr></thead><tbody>{(data as Evidence[]).map((e) => <tr key={e.id} className="hover:bg-brand-500/5"><td className="text-text-primary font-medium">{e.file_name}</td><td>{(e.type || '').replace(/_/g, ' ')}</td><td className="font-mono text-[10px] max-w-[200px] truncate">{e.sha256_hash}</td><td className="font-mono text-[10px]">{e.linked_entity_type}/{e.linked_entity_id.slice(0, 8)}…</td><td><StatusBadge status={e.review_status} /></td><td className="text-[11px]">{fmtDate(e.created_at)}</td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
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
  return <Layout currentPage="audit">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Hash</th><th></th></tr></thead><tbody>{(data as AuditEvent[]).map((a) => {
    const route = AUDIT_ENTITY_ROUTES[a.entity_type];
    return <tr key={a.id} className="hover:bg-brand-500/5">
      <td className="font-mono text-[10px] whitespace-nowrap">{new Date(a.occurred_at).toLocaleString()}</td>
      <td><span className="badge badge-blue">{a.action}</span></td>
      <td className="font-mono text-[10px]">{a.entity_type}/{a.entity_id.slice(0, 8)}</td>
      <td className="text-[11px]">{a.actor_user_id.slice(0, 8)}…</td>
      <td className="font-mono text-[10px]">{(a.new_state_hash || '').slice(0, 20)}…</td>
      <td>{route ? <button className="btn btn-sm text-[10px]" onClick={() => navigate(`${route}`)}>View →</button> : <span className="text-text-muted">—</span>}</td>
    </tr>;
  })}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function CertsPage() {
  return <Layout currentPage="certs"><div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">Certificates</div><p className="text-xs text-text-muted mt-1">Certificate management coming soon</p></div></Layout>;
}
