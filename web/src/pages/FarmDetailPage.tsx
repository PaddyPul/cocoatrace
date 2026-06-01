import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { farms as farmsApi, batches as batchesApi } from '../api';
import { Farm } from '../types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, MapPin, FileText } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { X } from 'lucide-react';

export default function FarmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [plots, setPlots] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [batchList, setBatchList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Plot creation
  const [showPlot, setShowPlot] = useState(false);
  const [plotCode, setPlotCode] = useState('');
  const [plotArea, setPlotArea] = useState(0);
  const [plotCrops, setPlotCrops] = useState('cocoa');
  const [plotGpsLat, setPlotGpsLat] = useState('');
  const [plotGpsLng, setPlotGpsLng] = useState('');
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      farmsApi.get(id),
      batchesApi.list(),
    ])
      .then(([farmData, batches]) => {
        setFarm(farmData.farm);
        setPlots(farmData.plots || []);
        setCertificates(farmData.certificates || []);
        setBatchList(batches.filter((b: any) => b.farm_id === id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCreatePlot = async () => {
    if (!id || !plotCode || !plotArea) { setPlotError('Plot code and area required'); return; }
    setPlotLoading(true); setPlotError('');
    try {
      await farmsApi.createPlot(id, { plotCode, areaHectares: Number(plotArea), crops: plotCrops.split(',').map((s) => s.trim()), gpsLat: plotGpsLat ? Number(plotGpsLat) : undefined, gpsLng: plotGpsLng ? Number(plotGpsLng) : undefined });
      setShowPlot(false); setPlotCode(''); setPlotArea(0); setPlotCrops('cocoa'); setPlotGpsLat(''); setPlotGpsLng('');
      const farmData = await farmsApi.get(id);
      setPlots(farmData.plots || []);
      toast('success', 'Plot added successfully');
    } catch (e: any) { setPlotError(e.message); } finally { setPlotLoading(false); }
  };

  if (loading) return <Layout currentPage="farm"><SkeletonDetail /></Layout>;
  if (error || !farm) return <Layout currentPage="farm"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Farm not found'}</div></Layout>;

  return (
    <Layout currentPage="farm" actions={<button className="btn btn-sm" onClick={() => navigate('/farms')}><ArrowLeft size={14} /> Back</button>}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="h-40 bg-surface-darker flex items-center justify-center text-5xl relative">
              🏡
              <div className="absolute top-3 right-3"><StatusBadge status={farm.verification_status} /></div>
            </div>
            <div className="p-5">
              <h1 className="text-xl font-bold text-text-primary mb-1">{farm.name}</h1>
              <p className="text-sm text-text-muted flex items-center gap-1"><MapPin size={14} />{farm.region}, {farm.district}{farm.country ? ` · ${farm.country}` : ''}</p>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">COCOBOD ID</div>
                  <div className="font-mono">{farm.official_traceability_id || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Organization</div>
                  <div className="text-text-primary font-medium">{farm.farmer_org_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Community</div>
                  <div>{farm.community || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {plots.length > 0 && (
            <div className="bg-surface border border-border rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin size={16} className="text-brand-400" /> Plots ({plots.length})</h3>
                {canDo('farm.create') && <button className="btn btn-sm" onClick={() => setShowPlot(true)}>+ Add Plot</button>}
              </div>
              <div className="space-y-2">
                {plots.map((p: any) => (
                  <div key={p.id} className="bg-surface-darker border border-border rounded p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-medium">{p.plot_code}</span>
                      <span className="badge badge-blue">{p.area_hectares} ha</span>
                    </div>
                    <div className="text-text-muted">{(p.crops || []).join(', ') || 'cocoa'}{p.gps_lat ? ` · ${p.gps_lat.toFixed(4)}, ${p.gps_lng.toFixed(4)}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {plots.length === 0 && canDo('farm.create') && (
            <div className="bg-surface border border-border rounded p-5 text-center">
              <div className="text-2xl mb-2">🗺️</div>
              <p className="text-sm text-text-muted mb-3">No plots registered yet</p>
              <button className="btn btn-sm btn-primary" onClick={() => setShowPlot(true)}>+ Add Plot</button>
            </div>
          )}

          {certificates.length > 0 && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText size={16} className="text-brand-400" /> Certificates ({certificates.length})</h3>
              <div className="space-y-2">
                {certificates.map((c: any) => (
                  <div key={c.id} className="bg-surface-darker border border-border rounded p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{c.standard}</span>
                      <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{c.status}</span>
                    </div>
                    <div className="text-text-muted">{fmtDate(c.valid_from)} → {fmtDate(c.valid_to)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {batchList.length > 0 && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">📦 Batches ({batchList.length})</h3>
              <div className="space-y-2">
                {batchList.map((b: any) => (
                  <div key={b.id} className="cursor-pointer bg-surface-darker border border-border rounded p-3 text-xs hover:bg-brand-500/5" onClick={() => navigate(`/batches/${b.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-medium">{b.id.slice(0, 8)}…</span>
                      <StatusBadge status={b.organic_claim_status} />
                    </div>
                    <div className="text-text-muted">{b.crop} · {fmtDate(b.harvest_date)} · {(b.quantity_kg || 0).toLocaleString()} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-text-muted">Plots</span><span className="font-medium">{plots.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Certificates</span><span className="font-medium">{certificates.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Batches</span><span className="font-medium">{batchList.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Total volume</span><span className="font-medium">{(batchList.reduce((s: number, b: any) => s + (b.quantity_kg || 0), 0)).toLocaleString()} kg</span></div>
            </div>
            {canDo('farm.create') && <button className="btn w-full justify-center mt-4 text-xs" onClick={() => setShowPlot(true)}>+ Add Plot</button>}
            <button className="btn w-full justify-center mt-2 text-xs" onClick={() => navigate('/farms')}>All Farms →</button>
          </div>
        </div>
      </div>

      {showPlot && (
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
                <button className="btn flex-1 justify-center" onClick={() => setShowPlot(false)} disabled={plotLoading}>Cancel</button>
                <button className="btn btn-primary flex-1 justify-center" onClick={handleCreatePlot} disabled={plotLoading || !plotCode || !plotArea}>
                  {plotLoading ? 'Creating…' : 'Add Plot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
