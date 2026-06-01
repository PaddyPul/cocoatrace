import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { offers as offersApi } from '../api';
import { Offer } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useToast } from '../components/shared/ToastProvider';
import { Check, X } from 'lucide-react';

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

export default function OffersPage() {
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => offersApi.list());
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [processing, setProcessing] = useState('');

  const handleAccept = async (offerId: string) => {
    setProcessing(offerId);
    try {
      await offersApi.accept(offerId);
      toast('success', 'Offer accepted! Contract created.');
      refetch();
    } catch (e: any) { toast('error', e.message); } finally { setProcessing(''); }
  };

  const handleReject = async (offerId: string) => {
    setConfirmReject(null);
    setProcessing(offerId);
    try {
      await offersApi.reject(offerId);
      toast('info', 'Offer rejected.');
      refetch();
    } catch (e: any) { toast('error', e.message); } finally { setProcessing(''); }
  };

  const offers = data as Offer[];
  const received = offers.filter((o) => o.seller_organization_id === user?.organizationId);
  const sent = offers.filter((o) => o.buyer_organization_id === user?.organizationId);
  const visible = tab === 'received' ? received : sent;
  const pending = visible.filter((o) => o.status === 'pending');
  const history = visible.filter((o) => o.status !== 'pending');

  return (
    <Layout currentPage="offers">
      {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error}</div> : <div className="table-wrap">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-1 bg-surface-darker rounded p-0.5">
            <button className={`btn btn-sm ${tab === 'received' ? 'btn-primary' : ''}`} onClick={() => setTab('received')}>Received ({received.length})</button>
            <button className={`btn btn-sm ${tab === 'sent' ? 'btn-primary' : ''}`} onClick={() => setTab('sent')}>Sent ({sent.length})</button>
          </div>
          <div className="text-xs text-text-muted">{visible.length} offer{visible.length !== 1 ? 's' : ''}</div>
        </div>

        {pending.length > 0 && (
          <>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Pending ({pending.length})</div>
            <table className="mb-6">
              <thead><tr><th>Listing</th><th>{tab === 'received' ? 'Buyer' : 'Seller'}</th><th>Qty (kg)</th><th>Price/kg</th><th>Total</th><th>Valid Until</th><th></th></tr></thead>
              <tbody>
                {pending.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{o.listing_id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{tab === 'received' ? (o.buyer_name || '—') : (o.seller_name || '—')}</td>
                    <td>{(o.quantity_kg || 0).toLocaleString()}</td>
                    <td className="font-mono">€{o.offered_price_per_kg}</td>
                    <td className="text-brand-400 font-mono">€{((o.quantity_kg || 0) * (o.offered_price_per_kg || 0)).toLocaleString()}</td>
                    <td className="text-[11px]">{o.valid_until ? fmtDate(o.valid_until) : '—'}</td>
                    <td>
                      {tab === 'received' ? (
                        <div className="flex gap-1">
                          <button className="btn btn-sm text-[10px] text-green-400 border-green-500/30" onClick={() => handleAccept(o.id)} disabled={processing === o.id}><Check size={12} /> {processing === o.id ? '…' : 'Accept'}</button>
                          <button className="btn btn-sm text-[10px] text-red-400 border-red-500/30" onClick={() => setConfirmReject(o.id)} disabled={processing === o.id}><X size={12} /> Reject</button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">Awaiting seller response</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {history.length > 0 && (
          <>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">History ({history.length})</div>
            <table>
              <thead><tr><th>Listing</th><th>{tab === 'received' ? 'Buyer' : 'Seller'}</th><th>Qty (kg)</th><th>Price/kg</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{o.listing_id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{tab === 'received' ? (o.buyer_name || '—') : (o.seller_name || '—')}</td>
                    <td>{(o.quantity_kg || 0).toLocaleString()}</td>
                    <td className="font-mono">€{o.offered_price_per_kg}</td>
                    <td className="text-brand-400 font-mono">€{((o.quantity_kg || 0) * (o.offered_price_per_kg || 0)).toLocaleString()}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {visible.length === 0 && <EmptyState icon="📨" title={tab === 'received' ? 'No offers received' : 'No offers sent'} description={tab === 'received' ? 'When buyers make offers on your listings, they appear here.' : 'When you make offers on marketplace listings, they appear here.'} action={<button className="btn btn-sm" onClick={() => navigate('/marketplace')}>Browse Marketplace →</button>} />}
      </div>}
      <ConfirmDialog
        open={!!confirmReject}
        title="Reject Offer"
        message="Are you sure you want to reject this offer? This action cannot be undone."
        confirmLabel="Reject"
        danger
        loading={!!processing}
        onConfirm={() => confirmReject && handleReject(confirmReject)}
        onCancel={() => setConfirmReject(null)}
      />
    </Layout>
  );
}