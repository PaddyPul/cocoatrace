import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { offers as offersApi } from '../api';
import { Offer } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
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

function Err({ msg }: { msg: string }) { return <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{msg}</div>; }

export default function OffersPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => offersApi.list());
  const [actionMsg, setActionMsg] = useState('');

  const handleAccept = async (offerId: string) => {
    try {
      await offersApi.accept(offerId);
      setActionMsg('Offer accepted! Contract created.');
      refetch();
    } catch (e: any) { setActionMsg(e.message); }
  };

  const handleReject = async (offerId: string) => {
    try {
      await offersApi.reject(offerId);
      setActionMsg('Offer rejected.');
      refetch();
    } catch (e: any) { setActionMsg(e.message); }
  };

  const offers = data as Offer[];
  const pending = offers.filter((o) => o.status === 'pending');
  const other = offers.filter((o) => o.status !== 'pending');

  return (
    <Layout currentPage="offers">
      {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-text-muted">{offers.length} offer{offers.length !== 1 ? 's' : ''}</div>
        </div>

        {actionMsg && <div className="bg-brand-500/10 border border-brand-500/30 rounded-sm px-3 py-2 text-xs text-brand-400 mb-3">{actionMsg}</div>}

        {pending.length > 0 && (
          <>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Pending ({pending.length})</div>
            <table className="mb-6">
              <thead><tr><th>Listing</th><th>Buyer</th><th>Qty (kg)</th><th>Price/kg</th><th>Total</th><th>Valid Until</th><th></th></tr></thead>
              <tbody>
                {pending.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{o.listing_id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{o.buyer_name || '—'}</td>
                    <td>{(o.quantity_kg || 0).toLocaleString()}</td>
                    <td className="font-mono">€{o.offered_price_per_kg}</td>
                    <td className="text-brand-400 font-mono">€{((o.quantity_kg || 0) * (o.offered_price_per_kg || 0)).toLocaleString()}</td>
                    <td className="text-[11px]">{o.valid_until ? fmtDate(o.valid_until) : '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm text-[10px] text-green-400 border-green-500/30" onClick={() => handleAccept(o.id)}><Check size={12} /> Accept</button>
                        <button className="btn btn-sm text-[10px] text-red-400 border-red-500/30" onClick={() => handleReject(o.id)}><X size={12} /> Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {other.length > 0 && (
          <>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">History ({other.length})</div>
            <table>
              <thead><tr><th>Listing</th><th>Buyer</th><th>Qty (kg)</th><th>Price/kg</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {other.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{o.listing_id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{o.buyer_name || '—'}</td>
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

        {offers.length === 0 && <EmptyState icon="📨" title="No offers yet" description="Offers appear when buyers express interest in your marketplace listings." action={<button className="btn btn-sm" onClick={() => navigate('/marketplace')}>Browse Marketplace →</button>} />}
      </div>}
    </Layout>
  );
}
