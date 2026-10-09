import PublicNoticesPanel from '../components/catalog/PublicNoticesPanel';
import PublicJourneyPanel from '../components/catalog/PublicJourneyPanel';
import PublicEvidencePanel from '../components/catalog/PublicEvidencePanel';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileCheck2, Leaf, MapPin, PackageCheck,
  ShieldCheck, Sprout,
} from 'lucide-react';
import TrustClaims, { trustLabel } from '../components/shared/TrustClaims';
import { publicProducts } from '../api';
import { PublicProduct, PublicNoticeSafety } from '../types';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Date not recorded';
}

export default function PublicProductPage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicProduct | null>(null);
  const [error, setError] = useState('');
  const [noticeSafety,setNoticeSafety]=useState<PublicNoticeSafety|null>(null);
  const updateSafety=useCallback((safety:PublicNoticeSafety|null)=>setNoticeSafety(safety),[]);
  const [tab, setTab] = useState<'journey' | 'proof'>('journey');

  useEffect(() => {
    let alive = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const product = await publicProducts.get(slug);
        if (alive) { setData(product); setError(''); document.title = `${product.profile.displayName} — CocoaTrace`; }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to refresh product record');
      } finally { refreshing = false; }
    };
    setData(null);
    setNoticeSafety(null);
    void refresh();
    publicProducts.recordScan(slug).catch(() => undefined);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(visible, 15_000);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [slug]);

  if (error) return <main className="min-h-screen bg-[#f6f4ee] text-stone-900 grid place-items-center p-6"><div className="max-w-md text-center"><div className="text-5xl mb-4">🌱</div><h1 className="text-2xl font-bold">Product profile unavailable</h1><p className="mt-2 text-stone-500">{error}</p><button className="mt-4 underline" onClick={() => window.location.reload()}>Retry product profile</button></div></main>;
  if (!data) return <main className="min-h-screen bg-[#f6f4ee] grid place-items-center"><div className="h-9 w-9 rounded-full border-2 border-stone-200 border-t-emerald-700 animate-spin" /></main>;

  const safety=noticeSafety;
  const unsafe = !safety || safety.status !== 'clear' || safety.inventoryHeld;
  return (
    <main className="min-h-screen bg-[#f6f4ee] text-stone-900 selection:bg-emerald-100">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f6f4ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-900 text-white"><Leaf size={17} /></span>CocoaTrace</div>
          <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${unsafe ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
            {!safety?'Safety status unavailable':safety.inventoryHeld?'INVENTORY SAFETY HOLD':unsafe?`${safety.status.toUpperCase()} NOTICE`:'No active recalls recorded'}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {(safety?.inventoryHeld || data.safety.inventoryHeld) && <section role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Material remains on safety hold</strong><p className="mt-2">Recall resolution does not make returned, destroyed or partially segregated inventory available for trade. Follow the recorded recovery instructions; this material remains blocked.</p></section>}
        <PublicNoticesPanel key={slug} slug={slug} onSafety={updateSafety} />

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="h-24 bg-gradient-to-br from-emerald-900 via-emerald-800 to-lime-700" />
              <div className="px-5 pb-5">
                <div className="-mt-10 grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-amber-100 text-4xl shadow-sm">🍫</div>
                <div className="mt-3 flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold leading-tight">{data.profile.displayName}</h1><p className="mt-1 text-sm text-stone-400">@{data.profile.slug}</p></div><PackageCheck className="shrink-0 text-stone-500" size={22} /></div>
                {data.profile.brandName && <p className="mt-3 text-sm font-semibold text-stone-700">{data.profile.brandName}</p>}
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{data.profile.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-stone-100 px-2.5 py-1 font-mono">LOT {data.profile.lotCode}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">{`Organic: ${trustLabel(data.trust?.organic)}`}</span></div>
                <div className="mt-5 border-t border-stone-100 pt-4 text-xs text-stone-500"><span className="inline-flex items-center gap-1.5"><MapPin size={13} />{data.origin.region}, {data.origin.country}</span><span className="mt-2 flex items-center gap-1.5"><Sprout size={13} />Harvested {formatDate(data.product.harvestDate)}</span></div>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 border-b border-stone-100">
              <div className="p-4 text-center"><div className="text-lg font-bold">{data.origin.plot_count}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Farm plots</div></div>
              <div className="border-x border-stone-100 p-4 text-center"><div className="text-lg font-bold">{Number(data.origin.total_area_hectares).toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Hectares</div></div>
              <div className="p-4 text-center"><div className="text-lg font-bold">{data.journeyPaging?.count ?? data.journey.length}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Trace events</div></div>
            </div>
            <nav className="flex border-b border-stone-100 px-5">
              {(['journey', 'proof'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`mr-6 border-b-2 py-4 text-sm font-semibold capitalize ${tab === item ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-stone-400'}`}>{item}</button>)}
            </nav>

            <div className="p-5 sm:p-7">
              {tab === 'journey' ? <>
                <div className="mb-6"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Farm to fork</div><h2 className="mt-1 text-2xl font-bold">This product's journey</h2><p className="mt-2 text-sm text-stone-500">Events are shown in time order. Entries describe recorded supply-chain activity. Authentication of a record does not independently verify a product claim.</p></div>
                <PublicJourneyPanel key={slug} slug={slug} />
              </> : <>
                <div className="mb-6"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Evidence</div><h2 className="mt-1 text-2xl font-bold">Claims with receipts</h2></div>
                <TrustClaims trust={data.trust} light /><div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 p-4"><ShieldCheck className="text-emerald-700" /><h3 className="mt-3 font-bold">Origin: {trustLabel(data.trust?.origin)}</h3><p className="mt-1 text-sm text-stone-500">{data.origin.farmName} · {data.origin.officialTraceabilityId || 'Platform identity'}</p><p className="mt-3 text-xs text-stone-400">Geolocation {data.origin.geolocation_complete ? 'complete' : 'requires review'} · EUDR cutoff {data.origin.eudr_cutoff_checked ? 'checked' : 'not complete'}</p></div>
                  {data.certificate && <div className="rounded-xl border border-stone-200 p-4"><FileCheck2 className="text-emerald-700" /><h3 className="mt-3 font-bold">{data.certificate.standard.replace(/_/g, ' ')}</h3><p className="mt-1 text-sm text-stone-500">{data.certificate.certifier_name}</p><p className="mt-3 text-xs text-stone-400">Reference {data.certificate.accreditation_reference}</p></div>}
                </div>
                <PublicEvidencePanel key={slug} slug={slug} />
              </>}
            </div>
          </section>
        </div>
        <footer className="py-8 text-center text-xs text-stone-400"><p>Live product record · Recall records checked {safety?new Date(safety.checkedAt).toLocaleTimeString():'unavailable'}</p><p className="mt-1">CocoaTrace shows recorded evidence; it does not replace regulator or manufacturer recall instructions.</p></footer>
      </div>
    </main>
  );
}
