import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, MapPin, Search, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert } from 'lucide-react';
import { listings, sourcing } from '../api';
import { Listing, SourcingRequest } from '../types';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';

const SHORTLIST_KEY = 'ct_shortlisted_listings';

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthCtx();
  const [all, setAll] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<SourcingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [sort, setSort] = useState('match');
  const [showFilters, setShowFilters] = useState(false);
  const [origin, setOrigin] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [shortlisted, setShortlisted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(SHORTLIST_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let refreshing = false;
    setAll([]);
    setRequests([]);
    setLoading(true);
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const [listingRows, requestRows] = await Promise.all([listings.list(), sourcing.list().catch(() => [])]);
        if (alive) { setAll(listingRows); setRequests(requestRows); setError(''); }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to refresh marketplace supply.');
      } finally {
        refreshing = false;
        if (alive) setLoading(false);
      }
    };
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(onVisible, 15_000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [user?.id]);
  const explicitRequestId = params.get('request');
  const requestedId = explicitRequestId || localStorage.getItem('ct_active_sourcing_request');
  const contextRequest = requests.find((item) => item.id === requestedId && item.buyer_organization_id === user?.organizationId)
    || requests.find((item) => item.status === 'open' && item.buyer_organization_id === user?.organizationId);
  // A saved brief is context, never an implicit filter on ordinary marketplace navigation.
  const matchingRequest = Boolean(explicitRequestId && params.get('browse') !== 'all' && !params.get('published'));
  const activeRequest = matchingRequest ? requests.find((item) => item.id === explicitRequestId && item.buyer_organization_id === user?.organizationId) : undefined;
  const browseAll = () => { const next = new URLSearchParams(params); next.set('browse', 'all'); setParams(next); };
  const matchRequest = () => { if (!contextRequest) return; const next = new URLSearchParams(params); next.set('request', contextRequest.id); next.delete('browse'); next.delete('published'); setParams(next); };
  const publishedId = params.get('published');
  const result = useMemo(() => all.map((item) => ({ item, score: score(item, activeRequest), gaps: gaps(item, activeRequest) })).filter(({ item }) => (!activeRequest || normalized(item.crop) === normalized(activeRequest.commodity)) && (!search || `${item.seller_name} ${item.farm_name} ${item.source_name} ${item.farm_region} ${item.source_region} ${item.crop}`.toLowerCase().includes(search.toLowerCase())) && (!organicOnly || item.organic_claim_status === 'attested') && (!origin || `${item.farm_region} ${item.source_region} ${item.origin_location}`.toLowerCase().includes(origin.toLowerCase())) && (!minimumQuantity || Number(item.available_quantity_kg) >= Number(minimumQuantity))).sort((a, b) => {
    if (publishedId && a.item.id === publishedId) return -1;
    if (publishedId && b.item.id === publishedId) return 1;
    return sort === 'price' ? Number(a.item.price_per_kg) - Number(b.item.price_per_kg) : sort === 'quantity' ? Number(b.item.available_quantity_kg) - Number(a.item.available_quantity_kg) : b.score - a.score;
  }), [all, activeRequest, search, organicOnly, origin, minimumQuantity, sort, publishedId]);
  const toggleShortlist = (id: string) => {
    const next = new Set(shortlisted);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShortlisted(next);
    sessionStorage.setItem(SHORTLIST_KEY, JSON.stringify([...next]));
  };

  return <Layout currentPage="marketplace" actions={<button className="btn btn-primary" onClick={() => navigate('/source/compare')} disabled={!shortlisted.size}>Compare shortlisted{shortlisted.size ? ` (${shortlisted.size})` : ''}</button>}>
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Matched traceable supply</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Evaluate supply before the first email.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">Ranking combines commercial fit with documented readiness. Missing proof remains visible and no supplier is described as risk-free.</p></div>{contextRequest ? <div className="rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4 lg:max-w-sm"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-300">{activeRequest ? 'Matching your request' : 'Your sourcing brief · browse all supply'}</div><div className="mt-2 text-sm font-semibold">{contextRequest.title}</div><div className="mt-1 text-[10px] text-text-muted">{Number(contextRequest.quantity_kg).toLocaleString()} kg · {contextRequest.incoterm} {contextRequest.delivery_location}</div></div> : <button className="btn" onClick={() => navigate('/source/new')}>Create sourcing brief</button>}</div></section>
    <div className="mt-4 flex flex-wrap items-center gap-3" aria-label="Supply browsing mode"><button className={`btn ${!activeRequest ? 'btn-primary' : ''}`} onClick={browseAll} aria-pressed={!activeRequest}>Browse all supply</button><button className={`btn ${activeRequest ? 'btn-primary' : ''}`} onClick={matchRequest} disabled={!contextRequest} aria-pressed={Boolean(activeRequest)}>Match my sourcing request</button><span className="text-xs text-text-muted">{activeRequest ? `Filtered to ${activeRequest.commodity}; other commodities are hidden.` : 'All published commodities are included. Your search and filters still apply.'}</span></div>
    {matchingRequest && !activeRequest && !loading && <div className="mt-3 text-xs text-amber-300">This sourcing request is unavailable. Showing all published supply.</div>}
    {publishedId && !loading && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-4 text-xs text-text-secondary"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="font-semibold text-white">{all.some((item) => item.id === publishedId) ? 'Your supply is visible in the marketplace' : 'This listing is not currently available in the marketplace'}</div><div className="mt-1">{all.some((item) => item.id === publishedId) ? 'It is ranked first below when it meets your search and filters. Organic verification depends on recorded evidence.' : 'It may have been committed to a trade or unpublished. Review your inventory and published supply.'}</div></div></div>}
    <div className="mt-5 flex flex-wrap items-center gap-3"><div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input className="form-input pl-9" placeholder="Search supply, origin or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><label className="btn cursor-pointer"><input type="checkbox" checked={organicOnly} onChange={(e) => setOrganicOnly(e.target.checked)} className="accent-[#7dcc61]" />Organic verified only</label><button className={`btn ${showFilters ? 'border-brand-400/40 text-brand-300' : ''}`} onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><SlidersHorizontal size={14} />Filters</button><select className="form-select w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="match">Best match</option><option value="price">Lowest price</option><option value="quantity">Most available</option></select><span className="text-[10px] text-text-muted">Showing {result.length} of {all.length}</span></div>
    {showFilters && <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"><label><span className="form-label">Origin or region</span><input className="form-input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Ashanti" /></label><label><span className="form-label">Minimum available (kg)</span><input type="number" min="0" className="form-input" value={minimumQuantity} onChange={(e) => setMinimumQuantity(e.target.value)} placeholder="e.g. 10000" /></label></div>}
    {loading ? <div className="loading"><div className="spinner" />Finding supply…</div> : error ? <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-300">{error}</div> : result.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{result.map(({ item, score: match, gaps: issues }) => <article key={item.id} className={`group overflow-hidden rounded-3xl border bg-surface transition hover:-translate-y-0.5 hover:border-brand-400/35 ${item.id === publishedId ? 'border-brand-400/60 ring-1 ring-brand-400/20' : 'border-border'}`}><div className="relative h-36 overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(239,190,106,.35),transparent_30%),linear-gradient(145deg,#392317,#8f5b34)] p-4"><div className="flex items-start justify-between"><span className="badge badge-green">{item.id === publishedId ? 'Just published' : activeRequest ? `${match}% request match` : 'Published supply'}</span><span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] text-white/75"><MapPin size={11} />{item.farm_region || item.source_region || item.origin_location || 'Origin recorded'}</span></div><div className="absolute bottom-4 left-4 flex items-center gap-2 text-[10px] text-white/70"><ShieldCheck size={14} />{item.source_mode === 'direct_inventory' ? 'Supplier-declared inventory' : 'Field-to-lot trace available'}</div></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold">{item.farm_name || item.source_name || `${item.crop || 'Material'} inventory`}</h3><p className="mt-1 text-[11px] text-text-muted">{item.seller_name || 'Recorded supplier'} · {Number(item.available_quantity_kg).toLocaleString()} kg available</p></div>{activeRequest && <MatchRing value={match} />}</div><div className="mt-5 flex items-end justify-between border-y border-border py-4"><div><div className="text-[9px] uppercase tracking-wider text-text-muted">Indicative price</div><div className="mt-1 font-mono text-xl font-bold text-brand-300">€{Number(item.price_per_kg).toFixed(2)}<span className="text-[10px] font-normal text-text-muted">/kg</span></div></div><div className="text-right"><div className="text-[9px] uppercase tracking-wider text-text-muted">Delivery</div><div className="mt-1 text-xs font-semibold">{item.incoterm} {item.destination_location || 'Destination open'}</div></div></div><div className="mt-4 grid grid-cols-3 gap-2"><Signal ok={Boolean(item.farm_region || item.source_country || item.origin_location)} label="Origin" value={item.farm_region || item.source_country || 'Recorded'} /><Signal ok={item.organic_claim_status === 'attested'} label="Organic" value={item.organic_claim_status === 'attested' ? 'Verified' : 'Not claimed'} /><Signal ok={issues.length === 0} label="Open gaps" value={String(issues.length)} /></div>{issues.length > 0 && <div className="mt-3 text-[10px] text-amber-300">Gaps: {issues.join(', ')}</div>}<div className="mt-5 flex gap-2"><button className="btn btn-primary flex-1 justify-center" onClick={() => navigate(`/listing/${item.id}`)}>View supply details <ArrowRight size={14} /></button><button className={`btn ${shortlisted.has(item.id) ? 'border-brand-400/40 bg-brand-400/10 text-brand-300' : ''}`} onClick={() => toggleShortlist(item.id)}><CheckCircle2 size={15} /></button></div></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted"><div>{activeRequest ? `No published ${activeRequest.commodity} supply matches this request yet.` : 'No supply matches these filters.'}</div>{activeRequest && <button className="btn mt-4" onClick={browseAll}>Browse all supply</button>}</div>}
    <section className="mt-5 flex items-start gap-4 rounded-3xl border border-border bg-surface-darker p-5"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="text-sm font-bold">“Verified” means inspectable, not guaranteed.</div><p className="mt-1 text-xs leading-5 text-text-muted">Every claim shows its source, reviewer, freshness and unresolved gaps. CocoaTrace preserves evidence and decisions; certification bodies, laboratories and responsible operators retain their authority.</p></div><Sparkles size={18} className="ml-auto hidden text-brand-400 sm:block" /></section>
  </Layout>;
}
function normalized(value?: string) { return (value || '').toLowerCase().replace(/\b(beans?|nuts?|kernels?|raw)\b/g, '').replace(/\s+/g, ' ').trim(); }
function score(item: Listing, request?: SourcingRequest) { if (!request) { let value = 55; if (item.organic_claim_status === 'attested') value += 20; if (item.farm_region || item.source_country) value += 10; return Math.min(95, value); } let value = normalized(item.crop) === normalized(request.commodity) ? 40 : 0; if (Number(item.available_quantity_kg) >= Number(request.quantity_kg)) value += 20; else value += Math.round(20 * Math.min(1, Number(item.available_quantity_kg) / Number(request.quantity_kg))); const wantsOrganic = Boolean(request.assurance_requirements?.organic || request.assurance_requirements?.euOrganic); if (!wantsOrganic || item.organic_claim_status === 'attested') value += 20; const countries = request.origin_countries || []; if (!countries.length || countries.includes(item.farm_country || item.source_country || '')) value += 10; if (item.incoterm === request.incoterm) value += 10; return Math.min(100, value); }
function gaps(item: Listing, request?: SourcingRequest) { const items: string[] = []; if (!request) { if (!item.farm_region && !item.source_country) items.push('origin not recorded'); return items; } if (normalized(item.crop) !== normalized(request.commodity)) items.push('commodity mismatch'); if (Number(item.available_quantity_kg) < Number(request.quantity_kg)) items.push('quantity shortfall'); if (Boolean(request.assurance_requirements?.organic || request.assurance_requirements?.euOrganic) && item.organic_claim_status !== 'attested') items.push('organic evidence'); if (Boolean(request.assurance_requirements?.plotGeolocation) && item.source_mode === 'direct_inventory') items.push('plot geolocation'); if (request.origin_countries?.length && !request.origin_countries.includes(item.farm_country || item.source_country || '')) items.push('origin mismatch'); if (item.incoterm !== request.incoterm) items.push('Incoterm differs'); return items; }
function Signal({ ok, label, value }: { ok: boolean; label: string; value: string }) { return <div className="rounded-xl bg-surface-darker p-3"><div className={`flex items-center gap-1 text-[9px] ${ok ? 'text-brand-300' : 'text-amber-300'}`}>{ok ? <CheckCircle2 size={11} /> : <TriangleAlert size={11} />}{label}</div><div className="mt-1 truncate text-[10px] font-semibold">{value}</div></div>; }
function MatchRing({ value }: { value: number }) { return <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#7dcc61 ${value * 3.6}deg, rgba(255,255,255,.08) 0)` }}><div className="grid h-8 w-8 place-items-center rounded-full bg-surface font-mono text-[10px] font-bold">{value}</div></div>; }
