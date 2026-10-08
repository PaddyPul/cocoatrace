import FarmPlots from '../components/catalog/FarmPlots';
import FarmCertificates from '../components/catalog/FarmCertificates';
import FarmBatches from '../components/catalog/FarmBatches';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { farms as farmsApi } from '../api';
import { Farm } from '../types';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, MapPin } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { X } from 'lucide-react';

export default function FarmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [plotVersion,setPlotVersion]=useState(0);
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
    farmsApi.get(id).then(farmData=>{
      setFarm(farmData.farm);
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
      setPlotVersion(value=>value+1);
      toast('success', 'Plot added successfully');
    } catch (e: any) { setPlotError(e.message); } finally { setPlotLoading(false); }
  };

  if (loading) return <Layout currentPage="farm"><SkeletonDetail /></Layout>;
  if (error || !farm) return <Layout currentPage="farm"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Farm not found'}</div></Layout>;

  return (
    <Layout currentPage="farm" actions={<button className="btn btn-sm" onClick={() => navigate('/farms')}><ArrowLeft size={14} /> Back</button>}>
      {canDo('evidence.upload') && <button className="btn mb-4" onClick={()=>navigate(`/evidence/contribute?entityType=farm&entityId=${id}`)}>Add supporting evidence</button>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="h-40 bg-surface-darker flex items-center justify-center text-5xl relative">
              🏡
              <div className="absolute top-3 right-3"><span className="badge badge-amber">{farm.verification_status === 'verified' ? 'Legacy status · review details unavailable' : farm.verification_status === 'self_declared' ? 'Supplier declared' : 'Review pending'}</span></div>
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

          <FarmPlots key={`${id}:${plotVersion}`} farmId={id!} onCreate={canDo('farm.create')?()=>setShowPlot(true):undefined}/>

          <FarmCertificates key={id} farmId={id!} />

          {canDo('batch.read') && <FarmBatches farmId={id!} />}

        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-text-muted">Plots</span><span className="font-medium">See plot panel</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Certificates</span><span className="font-medium">See certificate panel</span></div>
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
