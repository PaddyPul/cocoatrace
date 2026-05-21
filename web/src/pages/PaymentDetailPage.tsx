import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payments } from '../api';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Euro, CreditCard, Building2, User } from 'lucide-react';
import { usePermission } from '../hooks/usePermission';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = usePermission();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    payments.get(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout currentPage="payments"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="payments"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const p = data;

  return (
    <Layout
      currentPage="payments"
      actions={<button className="btn btn-sm" onClick={() => navigate('/payments')}><ArrowLeft size={14} /> Back</button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold">Payment Request</h1>
                <p className="font-mono text-xs text-text-muted mt-0.5">{p.id}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Amount</div>
                <div className="text-2xl font-bold font-mono text-brand-400">{fmtMoney(p.amount_total, p.currency)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Currency</div>
                <div className="text-sm font-medium">{p.currency}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div>
                <StatusBadge status={p.status} />
              </div>
              {p.seller_name && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Seller</div>
                  <div className="text-sm flex items-center gap-1"><Building2 size={14} /> {p.seller_name}</div>
                </div>
              )}
              {p.buyer_name && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Buyer</div>
                  <div className="text-sm flex items-center gap-1"><User size={14} /> {p.buyer_name}</div>
                </div>
              )}
              {p.payment_reference_external && (
                <div className="col-span-2">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Transaction Reference</div>
                  <div className="font-mono text-xs">{p.payment_reference_external}</div>
                </div>
              )}
              {p.settled_at && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Settled At</div>
                  <div className="text-sm">{fmtDate(p.settled_at)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Contract summary */}
          {p.quantity_kg && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3">Contract Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</div>
                  <div className="text-sm font-mono">{(p.quantity_kg || 0).toLocaleString()} kg</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price</div>
                  <div className="text-sm font-mono">€{Number(p.price_per_kg || 0).toFixed(2)}/kg</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Incoterm</div>
                  <div className="text-sm font-mono">{p.incoterm || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Quick Actions</h4>
            <div className="space-y-2">
              <button className="btn w-full justify-center text-xs">
                <CreditCard size={14} /> Download Receipt
              </button>
              {p.status === 'requested' && canDo('payment.confirm') && (
                <button className="btn btn-primary w-full justify-center text-xs">
                  <Euro size={14} /> Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
