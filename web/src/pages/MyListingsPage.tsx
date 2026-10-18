import { ApiError } from '../api/http';
import { useDiscardChanges } from '../components/shared/UnsavedChanges';
import ListingLifecycle from '../components/listings/ListingLifecycle';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listings } from '../api';
import type { Listing } from '../domains/marketplace/types';
import { fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { trustLabel } from '../components/shared/TrustClaims';
import Layout from '../components/layout/Layout';
import { Search, Package, Euro, MapPin } from 'lucide-react';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const fetchListings = useCallback(async (parameters: Record<string, string>) => {
    try {
      const result = await listings.page(parameters);
      setAccessDenied(false);
      return result;
    } catch (failure) {
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status))
        setAccessDenied(true);
      throw failure;
    }
  }, []);
  const page = useCatalogPage(
    fetchListings,
    { mine: 'true', search: appliedSearch },
    { retainDuringRefresh: true },
  );
  const { items: mine, loading, error } = page;
  const discard = useDiscardChanges();
  const retained = useRef<{ key: string; rows: typeof mine }>({ key: '', rows: [] });
  const context = JSON.stringify([user?.id, user?.organizationId, appliedSearch, page.pageNumber]);
  if (retained.current.key !== context) retained.current = { key: context, rows: [] };
  if (!loading && !error) retained.current.rows = mine;
  if (accessDenied) retained.current.rows = [];
  const filtered = accessDenied ? [] : loading || error ? retained.current.rows : mine;
  const navigation = {
    ...page,
    next: () => discard(page.next),
    previous: () => discard(page.previous),
  };

  return (
    <Layout currentPage="my-listings">
      {error && (
        <div role="alert">
          {error}
          <button className="btn ml-3" onClick={page.refresh}>
            Retry listings
          </button>
        </div>
      )}
      {loading && !filtered.length ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                aria-label="Search my listings"
                maxLength={80}
                placeholder="Search my listings…"
                className="form-input pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn"
              onClick={() =>
                discard(() => {
                  setAppliedSearch(search.trim());
                  page.refresh();
                })
              }
            >
              Search listings
            </button>
            <PageNavigation page={navigation} label="listings" />
            <div className="text-xs text-text-muted">
              On this page: {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {!loading &&
          !error &&
          filtered.length === 0 &&
          mine.length === 0 &&
          !appliedSearch &&
          page.pageNumber === 1 ? (
            <EmptyState
              icon="🏷"
              title="No listings yet"
              description="Create or select inventory, then publish the quantity and terms buyers can review."
              action={
                <button className="btn btn-sm btn-primary" onClick={() => navigate('/supply/new')}>
                  Publish supply →
                </button>
              }
            />
          ) : !loading && !error && filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No listings match"
              description="Try adjusting your search."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  className="bg-surface border border-border rounded overflow-hidden cursor-pointer hover:border-brand-500/30 transition-all group"
                  onClick={() => navigate(`/listing/${l.id}`)}
                >
                  <div className="h-28 bg-surface-darker flex items-center justify-center text-3xl relative">
                    🏷
                    <div className="absolute top-2 right-2">
                      <span className="badge badge-amber">
                        Organic: {trustLabel(l.trust?.organic)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <ListingLifecycle
                      listing={l}
                      owner={l.seller_organization_id === user?.organizationId}
                      onRenew={page.refresh}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary truncate">
                          {l.farm_name || 'Unknown Farm'}
                        </h3>
                        <p className="text-[11px] text-text-muted">
                          <MapPin size={11} className="inline" /> {l.farm_region || '—'}
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
                        <div className="text-sm font-mono">
                          {(l.available_quantity_kg || 0).toLocaleString()} kg
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      {l.grade && (
                        <>
                          <Package size={12} /> {l.grade}
                        </>
                      )}
                      {l.incoterm && (
                        <>
                          <Euro size={12} /> {l.incoterm}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
