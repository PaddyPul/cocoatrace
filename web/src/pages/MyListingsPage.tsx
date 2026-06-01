import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listings } from '../api';
import { Listing } from '../types';
import { StatusBadge, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { Search, Package, Euro, MapPin } from 'lucide-react';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    listings.list()
      .then(setAll)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const mine = all.filter((l) => l.seller_organization_id === user?.organizationId);
  const filtered = mine.filter((l) => !search || l.farm_name?.toLowerCase().includes(search.toLowerCase()) || l.farm_region?.toLowerCase().includes(search.toLowerCase()) || (l.grade || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout currentPage="my-listings">
      {loading ? <SkeletonTable rows={4} cols={4} /> : error ? <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error}</div> : <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search my listings…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="text-xs text-text-muted">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {filtered.length === 0 && mine.length === 0 ? (
          <EmptyState icon="🏷" title="No listings yet" description="List your batches on the marketplace to start selling." action={<button className="btn btn-sm btn-primary" onClick={() => navigate('/marketplace')}>View Marketplace →</button>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🔍" title="No listings match" description="Try adjusting your search." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((l) => (
              <div key={l.id} className="bg-surface border border-border rounded overflow-hidden cursor-pointer hover:border-brand-500/30 transition-all group" onClick={() => navigate(`/listing/${l.id}`)}>
                <div className="h-28 bg-surface-darker flex items-center justify-center text-3xl relative">
                  🏷
                  <div className="absolute top-2 right-2"><StatusBadge status={l.organic_claim_status === 'attested' ? 'organic' : l.organic_claim_status} /></div>
                </div>
                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary truncate">{l.farm_name || 'Unknown Farm'}</h3>
                      <p className="text-[11px] text-text-muted"><MapPin size={11} className="inline" /> {l.farm_region || '—'}{l.origin_location ? ` · ${l.origin_location}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between pt-1 border-t border-border/50">
                    <div>
                      <div className="text-[10px] text-text-muted">Price</div>
                      <div className="text-lg font-bold font-mono text-brand-400">€{l.price_per_kg}<span className="text-xs text-text-muted font-normal">/kg</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted">Available</div>
                      <div className="text-sm font-mono">{(l.available_quantity_kg || 0).toLocaleString()} kg</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    {l.grade && <><Package size={12} /> {l.grade}</>}
                    {l.incoterm && <><Euro size={12} /> {l.incoterm}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </Layout>
  );
}
