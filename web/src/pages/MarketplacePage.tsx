import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listings } from '../api';
import { Listing } from '../types';
import { StatusBadge, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { Search, SlidersHorizontal, X } from 'lucide-react';

const INCOTERMS = ['FOB', 'CIF', 'DAP', 'EXW'];
const GRADES = ['A', 'B', 'C', 'Organic'];
const REGIONS = ['Ashanti', 'Brong-Ahafo', 'Western', 'Eastern', 'Central', 'Volta'];

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myListingsOnly, setMyListingsOnly] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [grade, setGrade] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    listings
      .list()
      .then(setAll)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = all
    .filter((l) => {
      if (myListingsOnly && l.seller_organization_id !== user?.organizationId) return false;
      if (search && !l.seller_name?.toLowerCase().includes(search.toLowerCase()) && !l.farm_region?.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (region && l.farm_region !== region) return false;
      if (grade && l.grade !== grade) return false;
      if (incoterm && l.incoterm !== incoterm) return false;
      if (organicOnly && l.organic_claim_status !== 'attested') return false;
      if (minPrice && (l.price_per_kg || 0) < Number(minPrice)) return false;
      if (maxPrice && (l.price_per_kg || 0) > Number(maxPrice)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'price_asc': return (a.price_per_kg || 0) - (b.price_per_kg || 0);
        case 'price_desc': return (b.price_per_kg || 0) - (a.price_per_kg || 0);
        case 'qty_desc': return (b.available_quantity_kg || 0) - (a.available_quantity_kg || 0);
        default: return 0;
      }
    });

  const activeFilterCount = [region, grade, incoterm, minPrice, maxPrice].filter(Boolean).length + (organicOnly ? 1 : 0);

  return (
    <Layout currentPage="marketplace">
      <div className="flex gap-6">
        {/* Filter sidebar */}
        {showFilters && (
          <aside className="w-56 shrink-0 hidden lg:block">
            <div className="bg-surface border border-border rounded p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Filters</h3>
                <button
                  className="text-[11px] text-brand-400 hover:text-brand-300"
                  onClick={() => {
                    setRegion('');
                    setGrade('');
                    setIncoterm('');
                    setOrganicOnly(false);
                    setMyListingsOnly(false);
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                >
                  Clear all
                </button>
              </div>

              <div>
                <label className="form-label">Origin Region</label>
                <select className="form-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">All regions</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Grade</label>
                <select className="form-select" value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="">All grades</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Incoterm</label>
                <select className="form-select" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                  <option value="">All</option>
                  {INCOTERMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Price per kg (€)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="form-input w-full"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="form-input w-full"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={organicOnly}
                  onChange={(e) => setOrganicOnly(e.target.checked)}
                />
                Organic certified only
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={myListingsOnly}
                  onChange={(e) => setMyListingsOnly(e.target.checked)}
                />
                My listings only
              </label>
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search + sort toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Search by seller or region…"
                className="form-input pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-sm lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={14} />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            <select
              className="form-select w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="qty_desc">Quantity: High → Low</option>
            </select>

            <span className="text-[11px] text-text-muted font-mono">
              {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {region && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-[11px] text-brand-400">
                  {region}
                  <X size={12} className="cursor-pointer" onClick={() => setRegion('')} />
                </span>
              )}
              {grade && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-[11px] text-brand-400">
                  Grade: {grade}
                  <X size={12} className="cursor-pointer" onClick={() => setGrade('')} />
                </span>
              )}
              {incoterm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-[11px] text-brand-400">
                  {incoterm}
                  <X size={12} className="cursor-pointer" onClick={() => setIncoterm('')} />
                </span>
              )}
              {organicOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-[11px] text-brand-400">
                  Organic
                  <X size={12} className="cursor-pointer" onClick={() => setOrganicOnly(false)} />
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-[11px] text-brand-400">
                  €{minPrice || '0'}–€{maxPrice || '∞'}
                  <X size={12} className="cursor-pointer" onClick={() => { setMinPrice(''); setMaxPrice(''); }} />
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="loading">
              <div className="spinner" />
              <div>Loading listings…</div>
            </div>
          ) : error ? (
            <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏷</div>
              <div className="empty-title">No listings match your filters</div>
              <p className="text-xs text-text-muted mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  className="bg-surface border border-border rounded overflow-hidden cursor-pointer hover:border-brand-500/30 transition-all group"
                  onClick={() => navigate(`/listing/${l.id}`)}
                >
                  {/* Card image area */}
                  <div className="h-36 bg-surface-darker flex items-center justify-center text-4xl relative overflow-hidden">
                    <span>🫘</span>
                    <div className="absolute top-2 right-2">
                      <StatusBadge status={l.organic_claim_status === 'attested' ? 'organic' : l.organic_claim_status} />
                    </div>
                    {l.grade && (
                      <div className="absolute top-2 left-2">
                        <span className="badge badge-blue">{l.grade}</span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary truncate">
                          {l.seller_name || 'Unknown Seller'}
                        </h3>
                        <p className="text-[11px] text-text-muted truncate">
                          {l.farm_region || 'Unknown region'}
                          {l.origin_location ? ` · ${l.origin_location}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-1 border-t border-border/50">
                      <div>
                        <div className="text-[10px] text-text-muted">Price</div>
                        <div className="text-lg font-bold font-mono text-brand-400">
                          €{l.price_per_kg}
                          <span className="text-xs text-text-muted font-normal">/kg</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted">Available</div>
                        <div className="text-sm font-mono text-text-primary">
                          {(l.available_quantity_kg || 0).toLocaleString()} kg
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      {l.incoterm && (
                        <span className="font-mono">{l.incoterm}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
