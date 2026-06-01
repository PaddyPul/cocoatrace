import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payments } from '../api';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Euro, CreditCard, Building2, User, Check, FileText } from 'lucide-react';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pay
  const [showPay, setShowPay] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [payDone, setPayDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    payments.get(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const isBuyer = data && user && data.buyer_organization_id === user.organizationId;

  const handlePay = async () => {
    if (!id || !txRef) { setPayError('Transaction reference required'); return; }
    setPayLoading(true); setPayError('');
    try {
      await payments.pay(id, { transactionReference: txRef });
      setPayDone(true);
      const updated = await payments.get(id);
      setData(updated);
      toast('success', 'Payment confirmed successfully');
    } catch (e: any) { setPayError(e.message); } finally { setPayLoading(false); }
  };

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
              {p.contract_id && (
                <button className="btn btn-sm mt-3" onClick={() => navigate(`/contracts/${p.contract_id}`)}>
                  <FileText size={14} /> View Contract
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Quick Actions</h4>
            <div className="space-y-2">
              {p.status === 'requested' && isBuyer && !showPay && !payDone && (
                <button className="btn btn-primary w-full justify-center text-xs" onClick={() => setShowPay(true)}>
                  <Euro size={14} /> Pay Now
                </button>
              )}

              {payDone && (
                <div className="text-center py-3">
                  <Check size={20} className="text-green-400 mx-auto mb-1" />
                  <div className="text-xs font-semibold text-green-400">Payment Confirmed!</div>
                </div>
              )}

              {showPay && !payDone && (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Transaction Reference</label>
                    <input className="form-input" placeholder="e.g. SWIFT:COCO12345" value={txRef} onChange={(e) => setTxRef(e.target.value)} />
                  </div>
                  {payError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{payError}</div>}
                  <div className="flex gap-2">
                    <button className="btn flex-1 justify-center text-xs" onClick={() => setShowPay(false)} disabled={payLoading}>Cancel</button>
                    <button className="btn btn-primary flex-1 justify-center text-xs" onClick={handlePay} disabled={payLoading || !txRef}>
                      {payLoading ? 'Processing…' : 'Confirm Payment'}
                    </button>
                  </div>
                </div>
              )}

              {p.status === 'settled' && (
                <button className="btn w-full justify-center text-xs" onClick={() => toast('info', 'Receipt download coming soon')}>
                  <CreditCard size={14} /> Download Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
