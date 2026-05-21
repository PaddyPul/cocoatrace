import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { holdings as holdingsApi } from '../api';
import { Holding, Batch } from '../types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, MapPin, ChevronRight } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function HoldingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [holding, setHolding] = useState<Holding | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    holdingsApi.get(id)
      .then((d) => {
        setHolding(d.holding);
        setBatch(d.batch);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout currentPage="holding"><SkeletonDetail /></Layout>;
  if (error || !holding) return <Layout currentPage="holding"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Holding not found'}</div></Layout>;

  return (
    <Layout currentPage="holding" actions={<button className="btn btn-sm" onClick={() => navigate('/holdings')}><ArrowLeft size={14} /> Back</button>}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="h-40 bg-surface-darker flex items-center justify-center text-5xl relative">
              📦
              <div className="absolute top-3 right-3"><StatusBadge status={holding.status} /></div>
            </div>
            <div className="p-5">
              <h1 className="text-xl font-bold text-text-primary mb-1">Holding {holding.id.slice(0, 8)}…</h1>
              <p className="text-sm text-text-muted">{holding.farm_name || 'Unknown'} · {holding.crop || 'cocoa'}</p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</div>
                  <div className="font-medium font-mono">{(holding.quantity_kg || 0).toLocaleString()} kg</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Warehouse</div>
                  <div className="font-medium">{holding.warehouse_location || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Grade</div>
                  <div className="font-medium">{holding.grade || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div>
                  <div><StatusBadge status={holding.status} /></div>
                </div>
              </div>
            </div>
          </div>

          {batch && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin size={16} className="text-brand-400" /> Source Batch</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Batch ID</div>
                  <div className="font-mono">{batch.id.slice(0, 13)}…</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Farm</div>
                  <div className="font-medium">{batch.farm_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Harvest Date</div>
                  <div>{fmtDate(batch.harvest_date)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Organic Status</div>
                  <StatusBadge status={batch.organic_claim_status} />
                </div>
              </div>
              <button className="btn btn-sm mt-3" onClick={() => navigate(`/batches/${batch.id}`)}>View Batch <ChevronRight size={14} /></button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Details</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-text-muted">Crop</span><span className="font-medium">{holding.crop || 'cocoa'}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Harvest</span><span className="font-medium">{holding.harvest_date ? fmtDate(holding.harvest_date) : '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Status</span><span><StatusBadge status={holding.status} /></span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <button className="btn w-full justify-center text-xs" onClick={() => navigate('/holdings')}>All Holdings →</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
