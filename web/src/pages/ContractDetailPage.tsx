import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { contracts, shipments } from '../api';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, FileText, Ship, Euro, MapPin, Hash, ChevronRight } from 'lucide-react';
import { usePermission } from '../hooks/usePermission';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = usePermission();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    contracts.get(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout currentPage="contracts"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="contracts"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const c = data;
  const totalValue = (c.quantity_kg || 0) * (c.price_per_kg || 0);

  return (
    <Layout
      currentPage="contracts"
      actions={<button className="btn btn-sm" onClick={() => navigate('/contracts')}><ArrowLeft size={14} /> Back</button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold">Sales Contract</h1>
                <p className="font-mono text-xs text-text-muted mt-0.5">{c.id}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Seller</div>
                <div className="text-sm font-medium">{c.seller_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Buyer</div>
                <div className="text-sm font-medium">{c.buyer_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</div>
                <div className="text-lg font-mono">{(c.quantity_kg || 0).toLocaleString()} kg</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price</div>
                <div className="text-lg font-mono text-brand-400">€{Number(c.price_per_kg).toFixed(2)}/kg</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Value</div>
                <div className="text-xl font-bold font-mono text-brand-400">{fmtMoney(totalValue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Incoterm</div>
                <div className="text-sm font-mono">{c.incoterm}</div>
              </div>
              {c.eudr_due_diligence_reference && (
                <div className="col-span-2">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">EUDR Reference</div>
                  <div className="font-mono text-xs text-text-muted">{c.eudr_due_diligence_reference}</div>
                </div>
              )}
            </div>
          </div>

          {c.shipment_id && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Ship size={16} className="text-brand-400" />
                Linked Shipment
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Vessel</div>
                  <div className="text-sm">{c.vessel_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Container</div>
                  <div className="font-mono text-xs">{c.container_reference || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">ETA</div>
                  <div className="text-sm">{fmtDate(c.eta_arrival)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div>
                  <StatusBadge status={c.current_milestone} />
                </div>
              </div>
              <button className="btn btn-sm mt-4" onClick={() => navigate(`/shipments/${c.shipment_id}`)}>
                View Shipment Details <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Quick Actions</h4>
            <div className="space-y-2">
              {canDo('contract.read') && (
                <button className="btn w-full justify-center text-xs">
                  <FileText size={14} /> Download Contract
                </button>
              )}
              {canDo('payment.request') && (
                <button className="btn w-full justify-center text-xs">
                  <Euro size={14} /> Request Payment
                </button>
              )}
              {c.shipment_id && (
                <button className="btn w-full justify-center text-xs" onClick={() => navigate(`/shipments/${c.shipment_id}`)}>
                  <Ship size={14} /> Track Shipment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
