import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, MapPin, Search, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert } from 'lucide-react';
import { listings, sourcing } from '../api';
import { Listing, SourcingRequest } from '../types';
import { isReviewed, trustLabel } from '../components/shared/TrustClaims';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';



export default function MarketplacePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthCtx();
  const SHORTLIST_KEY = `ct_shortlisted_listings:${user?.id}`;
  const [publishedListing, setPublishedListing] = useState<Listing | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const requestPage = useCatalogPage(sourcing.page, {mine:'true', search:requestSearch});
  const [selectedRequest, setSelectedRequest] = useState<SourcingRequest | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestRefresh, setRequestRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [sort, setSort] = useState('match');
  const [currency, setCurrency] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [origin, setOrigin] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [shortlisted, setShortlisted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(SHORTLIST_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const explicitRequestId = params.get('request');
  const requestedId = explicitRequestId || localStorage.getItem('ct_active_sourcing_request');
  useEffect(() => {
    let active = true;
    setSelectedRequest(null); setRequestError(''); setRequestLoading(Boolean(requestedId));
    if (requestedId) sourcing.page({mine:'true',id:requestedId,limit:'1'}).then(result => {
      if (!result || result.hasMore || result.nextCursor !== null) throw new Error('Invalid sourcing request response.');
      if (active) setSelectedRequest(result.items.find(row => row.id === requestedId && row.buyer_organization_id === user?.organizationId) || null);
    }).catch(() => { if (active) setRequestError('Selected sourcing request could not be loaded. Retry before matching.'); })
      .finally(() => { if (active) setRequestLoading(false); });
    return () => { active = false; };
  }, [requestedId, user?.id, requestRefresh]);
  const contextRequest = (selectedRequest?.buyer_organization_id === user?.organizationId ? selectedRequest : null) || (!requestedId ? requestPage.items.find(item => item.status === 'open' && item.buyer_organization_id === user?.organizationId) : undefined);
  // A saved brief is context, never an implicit filter on ordinary marketplace navigation.
  const matchingRequest = Boolean(explicitRequestId && params.get('browse') !== 'all' && !params.get('published'));
  const activeRequest = matchingRequest && contextRequest?.id === explicitRequestId ? contextRequest : undefined;
  const browseAll = () => { const next = new URLSearchParams(params); next.set('browse', 'all'); setParams(next); };
  const matchRequest = () => { if (!contextRequest) return; const next = new URLSearchParams(params); next.set('request', contextRequest.id); next.delete('browse'); next.delete('published'); setParams(next); };
  const publishedId = params.get('published');
  const page = useCatalogPage(listings.page, { search, commodity: activeRequest?.commodity || '', organic: String(organicOnly), origin, minimum: minimumQuantity || '0', currency, sort: sort === 'match' ? 'id' : sort });
  const loading = page.loading || (matchingRequest && requestLoading);
  const error = page.error;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') page.refresh(); };
    const interval = window.setInterval(onVisible, 15000);
    window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [page.refresh]);
  useEffect(() => {
    let active = true;
    setPublishedListing(null); setPublishedError(false); setPublishedLoading(Boolean(publishedId));
    if (publishedId) listings.page({id: publishedId}).then(result => { if (active) setPublishedListing(result.items[0] || null); }).catch(() => { if (active) setPublishedError(true); }).finally(() => { if (active) setPublishedLoading(false); });
    return () => { active = false; };
  }, [publishedId, user?.id, page.items]);
  const all = page.items;
  const result = useMemo(() => {
    const candidates = publishedListing && !all.some(item => item.id === publishedListing.id) && !search && !origin && !minimumQuantity && !organicOnly && !currency && !activeRequest ? [publishedListing, ...all] : all;
    const ranked = candidates.map(item => ({item, score: score(item, activeRequest), gaps: gaps(item, activeRequest)}));
    if (sort === 'match') ranked.sort((a,b) => b.score-a.score);
    if (publishedId) ranked.sort((a,b) => Number(b.item.id === publishedId)-Number(a.item.id === publishedId));
    return ranked;
  }, [all, activeRequest, sort, publishedId, publishedListing, search, origin, minimumQuantity, organicOnly, currency]);
  useEffect(() => { try { const stored: unknown = JSON.parse(sessionStorage.getItem(SHORTLIST_KEY) || '[]'); setShortlisted(new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0,20) : [])); } catch { setShortlisted(new Set()); } }, [SHORTLIST_KEY]);
  const toggleShortlist = (id: string) => {
    if (!shortlisted.has(id) && shortlisted.size >= 20) return;
    const next = new Set(shortlisted);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShortlisted(next);
    sessionStorage.setItem(SHORTLIST_KEY, JSON.stringify([...next]));
  };

  return <Layout currentPage="marketplace" actions={<button className="btn btn-primary" onClick={() => navigate('/source/compare')} disabled={!shortlisted.size}>Compare shortlisted{shortlisted.size ? ` (${shortlisted.size})` : ''}</button>}>
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Matched traceable supply</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Evaluate supply before the first email.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">Match scores compare commercial fit and documented readiness within the current page. Search and filters narrow the results before paging. Missing proof remains visible and no supplier is described as risk-free.</p></div>{contextRequest ? <div className="rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4 lg:max-w-sm"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-300">{activeRequest ? 'Matching your request' : 'Your sourcing brief · browse all supply'}</div><div className="mt-2 text-sm font-semibold">{contextRequest.title}</div><div className="mt-1 text-[10px] text-text-muted">{Number(contextRequest.quantity_kg).toLocaleString()} kg · {contextRequest.incoterm} {contextRequest.delivery_location}</div></div> : <button className="btn" onClick={() => navigate('/source/new')}>Create sourcing brief</button>}</div></section>
    <section aria-label="Sourcing request selector" className="mt-4 rounded-2xl border border-border p-4">
      <label><span className="form-label">Search your sourcing requests</span><input className="form-input" maxLength={80} value={requestSearch} onChange={event => setRequestSearch(event.target.value)} /></label>
      {contextRequest && <p className="mt-2 text-sm">Selected brief: {contextRequest.title}</p>}
      {requestError && <div role="alert">{requestError}<button className="btn" onClick={() => setRequestRefresh(value => value + 1)}>Retry selected request</button></div>}
      {requestPage.loading ? <p role="status">Loading sourcing requests…</p> : requestPage.error ? <div role="alert">Sourcing requests unavailable. {requestPage.error}<button className="btn" onClick={requestPage.refresh}>Retry sourcing requests</button></div> : <div><label htmlFor="sourcing-request-choice" className="form-label">Sourcing request</label><select id="sourcing-request-choice" className="form-select" value={contextRequest?.id || ''} onChange={event => {
        const selected = requestPage.items.find(item => item.id === event.target.value) || selectedRequest;
        if (!selected) return;
        setSelectedRequest(selected); localStorage.setItem('ct_active_sourcing_request',selected.id);
        const next = new URLSearchParams(params); next.set('request',selected.id); next.delete('browse'); next.delete('published'); setParams(next);
      }}><option value="">Choose a sourcing request</option>{contextRequest && !requestPage.items.some(item => item.id === contextRequest.id) && <option value={contextRequest.id}>{contextRequest.title}</option>}{requestPage.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
      {!requestPage.loading && !requestPage.error && !requestPage.items.length && <p>No sourcing requests match this search.</p>}
      <PageNavigation page={requestPage} label="sourcing requests" />
    </section>
    <div className="mt-4 flex flex-wrap items-center gap-3" aria-label="Supply browsing mode"><button className={`btn ${!activeRequest ? 'btn-primary' : ''}`} onClick={browseAll} aria-pressed={!activeRequest}>Browse all supply</button><button className={`btn ${activeRequest ? 'btn-primary' : ''}`} onClick={matchRequest} disabled={!contextRequest} aria-pressed={Boolean(activeRequest)}>Match my sourcing request</button><span className="text-xs text-text-muted">{activeRequest ? `Filtered to ${activeRequest.commodity}; other commodities are hidden.` : 'All published commodities are included. Your search and filters still apply.'}</span></div>
    {matchingRequest && !activeRequest && !loading && !requestError && <div className="mt-3 text-xs text-amber-300">This sourcing request is unavailable. Showing all published supply.</div>}
    {publishedId && !loading && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-4 text-xs text-text-secondary"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="font-semibold text-white">{publishedLoading ? 'Checking published listing availability…' : publishedListing ? 'Your supply is visible in the marketplace' : publishedError ? 'Published listing availability could not be checked' : 'This listing is not currently available in the marketplace'}</div><div className="mt-1">{publishedListing ? 'It is shown first below when browsing without filters. Other results are paged. Organic verification depends on recorded evidence.' : 'It may have been committed to a trade or unpublished. Retry or review your inventory and published supply.'}</div></div></div>}
    <div className="mt-5 flex flex-wrap items-center gap-3"><div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input className="form-input pl-9" aria-label="Search marketplace supply" maxLength={80} placeholder="Search supply, origin or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><label className="btn cursor-pointer"><input type="checkbox" checked={organicOnly} onChange={(e) => setOrganicOnly(e.target.checked)} className="accent-[#7dcc61]" />Organic reviewed only</label><button className={`btn ${showFilters ? 'border-brand-400/40 text-brand-300' : ''}`} onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><SlidersHorizontal size={14} />Filters</button><select aria-label="Marketplace currency" className="form-select w-auto" value={currency} onChange={event => { setCurrency(event.target.value); if (!event.target.value && sort === 'price') setSort('match'); }}><option value="">All currencies</option>{['EUR','USD','GHS','GBP','JPY'].map(code => <option key={code}>{code}</option>)}</select><select aria-label="Supply order" className="form-select w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="match">Best match on this page</option><option value="price" disabled={!currency}>Lowest price</option><option value="quantity">Most available</option></select><span className="text-[10px] text-text-muted">Choose one currency for price order. Showing {result.length} on this page</span></div>
    <PageNavigation page={page} label="supply" />
    {showFilters && <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"><label><span className="form-label">Origin or region</span><input maxLength={80} className="form-input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Ashanti" /></label><label><span className="form-label">Minimum available (kg)</span><input type="number" min="0" className="form-input" value={minimumQuantity} onChange={(e) => setMinimumQuantity(e.target.value)} placeholder="e.g. 10000" /></label></div>}
    {loading ? <div className="loading"><div className="spinner" />Finding supply…</div> : error ? <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-300">{error}</div> : result.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{result.map(({ item, score: match, gaps: issues }) => <article key={item.id} className={`group overflow-hidden rounded-3xl border bg-surface transition hover:-translate-y-0.5 hover:border-brand-400/35 ${item.id === publishedId ? 'border-brand-400/60 ring-1 ring-brand-400/20' : 'border-border'}`}><div className="relative h-36 overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(239,190,106,.35),transparent_30%),linear-gradient(145deg,#392317,#8f5b34)] p-4"><div className="flex items-start justify-between"><span className={`badge ${item.activeRecall ? 'badge-red' : 'badge-green'}`}>{item.activeRecall ? 'Recall hold' : item.id === publishedId ? 'Just published' : activeRequest ? `${match}% request match` : 'Published supply'}</span><span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] text-white/75"><MapPin size={11} />{item.farm_region || item.source_region || item.origin_location || 'Origin recorded'}</span></div><div className="absolute bottom-4 left-4 flex items-center gap-2 text-[10px] text-white/70"><ShieldCheck size={14} />{item.source_mode === 'direct_inventory' ? 'Supplier-declared inventory' : 'Field-to-lot trace available'}</div></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold">{item.farm_name || item.source_name || `${item.crop || 'Material'} inventory`}</h3><p className="mt-1 text-[11px] text-text-muted">{item.seller_name || 'Recorded supplier'} · {Number(item.available_quantity_kg).toLocaleString()} kg available</p></div>{activeRequest && <MatchRing value={match} />}</div><div className="mt-5 flex items-end justify-between border-y border-border py-4"><div><div className="text-[9px] uppercase tracking-wider text-text-muted">Indicative price</div><div className="mt-1 font-mono text-xl font-bold text-brand-300">{item.currency || 'EUR'} {Number(item.price_per_kg).toFixed(4)}<span className="text-[10px] font-normal text-text-muted">/kg</span></div></div><div className="text-right"><div className="text-[9px] uppercase tracking-wider text-text-muted">Delivery</div><div className="mt-1 text-xs font-semibold">{item.incoterm} {item.destination_location || 'Destination open'}</div></div></div><div className="mt-4 grid grid-cols-3 gap-2"><Signal ok={isReviewed(item.trust?.origin)} label="Origin" value={trustLabel(item.trust?.origin)} /><Signal ok={isReviewed(item.trust?.organic)} label="Organic" value={trustLabel(item.trust?.organic)} /><Signal ok={issues.length === 0} label="Open gaps" value={String(issues.length)} /></div>{issues.length > 0 && <div className="mt-3 text-[10px] text-amber-300">Gaps: {issues.join(', ')}</div>}{item.activeRecall && <p className="mt-3 text-xs text-red-300">Recall hold: offers and material movement are blocked.</p>}<div className="mt-5 flex gap-2"><button className="btn btn-primary flex-1 justify-center" onClick={() => navigate(`/listing/${item.id}`)}>View supply details <ArrowRight size={14} /></button><button className={`btn ${shortlisted.has(item.id) ? 'border-brand-400/40 bg-brand-400/10 text-brand-300' : ''}`} aria-label={`Shortlist ${item.id}`} disabled={shortlisted.size >= 20 && !shortlisted.has(item.id)} onClick={() => toggleShortlist(item.id)}><CheckCircle2 size={15} /></button></div></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted"><div>{activeRequest ? `No published ${activeRequest.commodity} supply matches this request yet.` : 'No supply matches these filters.'}</div>{activeRequest && <button className="btn mt-4" onClick={browseAll}>Browse all supply</button>}</div>}
    <section className="mt-5 flex items-start gap-4 rounded-3xl border border-border bg-surface-darker p-5"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="text-sm font-bold">Recorded evidence and reviewed claims are different.</div><p className="mt-1 text-xs leading-5 text-text-muted">Open supply details to inspect claim sources, review decisions and expiry dates. CocoaTrace preserves evidence and decisions; certification bodies, laboratories and responsible operators retain their authority.</p></div><Sparkles size={18} className="ml-auto hidden text-brand-400 sm:block" /></section>
  </Layout>;
}
function normalized(value?: string) { return (value || '').toLowerCase().replace(/\b(beans?|nuts?|kernels?|raw)\b/g, '').replace(/\s+/g, ' ').trim(); }
function score(item: Listing, request?: SourcingRequest) { if (!request) { let value = 55; if (isReviewed(item.trust?.organic)) value += 20; if (item.farm_region || item.source_country) value += 10; return Math.min(95, value); } let value = normalized(item.crop) === normalized(request.commodity) ? 40 : 0; if (Number(item.available_quantity_kg) >= Number(request.quantity_kg)) value += 20; else value += Math.round(20 * Math.min(1, Number(item.available_quantity_kg) / Number(request.quantity_kg))); const wantsOrganic = Boolean(request.assurance_requirements?.organic || request.assurance_requirements?.euOrganic); if (!wantsOrganic || isReviewed(item.trust?.organic)) value += 20; const countries = request.origin_countries || []; if (!countries.length || countries.includes(item.farm_country || item.source_country || '')) value += 10; if (item.incoterm === request.incoterm) value += 10; return Math.min(100, value); }
function gaps(item: Listing, request?: SourcingRequest) { const items: string[] = []; if (!request) { if (!item.farm_region && !item.source_country) items.push('origin not recorded'); return items; } if (normalized(item.crop) !== normalized(request.commodity)) items.push('commodity mismatch'); if (Number(item.available_quantity_kg) < Number(request.quantity_kg)) items.push('quantity shortfall'); if (Boolean(request.assurance_requirements?.organic || request.assurance_requirements?.euOrganic) && !isReviewed(item.trust?.organic)) items.push('organic evidence'); if (Boolean(request.assurance_requirements?.plotGeolocation) && item.source_mode === 'direct_inventory') items.push('plot geolocation'); if (request.origin_countries?.length && !request.origin_countries.includes(item.farm_country || item.source_country || '')) items.push('origin mismatch'); if (item.incoterm !== request.incoterm) items.push('Incoterm differs'); return items; }
function Signal({ ok, label, value }: { ok: boolean; label: string; value: string }) { return <div className="rounded-xl bg-surface-darker p-3"><div className={`flex items-center gap-1 text-[9px] ${ok ? 'text-brand-300' : 'text-amber-300'}`}>{ok ? <CheckCircle2 size={11} /> : <TriangleAlert size={11} />}{label}</div><div className="mt-1 truncate text-[10px] font-semibold">{value}</div></div>; }
function MatchRing({ value }: { value: number }) { return <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#7dcc61 ${value * 3.6}deg, rgba(255,255,255,.08) 0)` }}><div className="grid h-8 w-8 place-items-center rounded-full bg-surface font-mono text-[10px] font-bold">{value}</div></div>; }
