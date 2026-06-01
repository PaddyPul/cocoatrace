import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { holdings as holdingsApi } from '../api';
import { Holding, Batch } from '../types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, MapPin, ChevronRight, X } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function HoldingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const [holding, setHolding] = useState<Holding | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [tfOrgId, setTfOrgId] = useState('');
  const [tfQty, setTfQty] = useState(0);
  const [tfReason, setTfReason] = useState('');
  const [tfLoading, setTfLoading] = useState(false);
  const [tfError, setTfError] = useState('');
  const [tfDone, setTfDone] = useState(false);

  const handleTransfer = async () => {
    if (!id || !tfOrgId || !tfQty) { setTfError('Organization ID and quantity required'); return; }
    setTfLoading(true); setTfError('');
    try {
      await holdingsApi.transfer(id, { toOrganizationId: tfOrgId, quantityKg: Number(tfQty), reason: tfReason || undefined });
      setShowTransfer(false); setTfDone(true);
      toast('success', 'Custody transfer initiated');
    } catch (e: any) { setTfError(e.message); } finally { setTfLoading(false); }
  };

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
              {canDo('custody.transfer.request') && !tfDone && (
                <button className="btn w-full justify-center text-xs" onClick={() => setShowTransfer(true)}>Transfer Custody</button>
              )}
              {tfDone && <div className="text-xs text-green-400 text-center font-semibold">Transfer initiated</div>}
              <button className="btn w-full justify-center text-xs" onClick={() => navigate('/holdings')}>All Holdings →</button>
            </div>
          </div>
        </div>
      </div>

      {showTransfer && (
        <div className="modal-overlay" onClick={() => !tfLoading && setShowTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div><div className="modal-title">Transfer Custody</div></div>
              <button className="btn btn-sm" onClick={() => setShowTransfer(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <input className="form-input" placeholder="Recipient Organization ID *" value={tfOrgId} onChange={(e) => setTfOrgId(e.target.value)} />
              <input type="number" className="form-input" placeholder="Quantity (kg) *" value={tfQty || ''} onChange={(e) => setTfQty(Number(e.target.value))} />
              <textarea className="form-input" rows={2} placeholder="Reason (optional)" value={tfReason} onChange={(e) => setTfReason(e.target.value)} />
              {tfError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{tfError}</div>}
              <div className="flex gap-2 pt-1">
                <button className="btn flex-1 justify-center" onClick={() => setShowTransfer(false)} disabled={tfLoading}>Cancel</button>
                <button className="btn btn-primary flex-1 justify-center" onClick={handleTransfer} disabled={tfLoading || !tfOrgId || !tfQty}>
                  {tfLoading ? 'Transferring…' : 'Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
