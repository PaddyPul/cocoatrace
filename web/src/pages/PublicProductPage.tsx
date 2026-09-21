import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, FileCheck2, Leaf, MapPin, PackageCheck,
  ShieldCheck, Sprout, Truck, UsersRound,
} from 'lucide-react';
import { publicProducts } from '../api';
import { JourneyEvent, PublicProduct } from '../types';

const eventIcons = {
  harvest: Sprout,
  verification: ShieldCheck,
  custody: UsersRound,
  shipment: Truck,
  recall: AlertTriangle,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function EventCard({ event, last }: { event: JourneyEvent; last: boolean }) {
  const Icon = eventIcons[event.type] || PackageCheck;
  return (
    <div className="relative flex gap-4 pb-7">
      {!last && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-emerald-900/20" />}
      <div className={`relative z-10 h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${event.type === 'recall' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-stone-900 capitalize">{event.title}</h3>
          {event.verified && <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"><CheckCircle2 size={12} /> verified</span>}
        </div>
        <p className="mt-1 text-sm text-stone-600">{event.summary}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-400">
          <span>{formatDate(event.occurredAt)}</span>
          {event.organization && <span>{event.organization}</span>}
          {event.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{event.location}</span>}
        </div>
      </div>
    </div>
  );
}

export default function PublicProductPage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicProduct | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'journey' | 'proof'>('journey');

  useEffect(() => {
    publicProducts.get(slug)
      .then((product) => {
        setData(product);
        publicProducts.recordScan(slug).catch(() => undefined);
        document.title = `${product.profile.displayName} — CocoaTrace`;
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <main className="min-h-screen bg-[#f6f4ee] text-stone-900 grid place-items-center p-6"><div className="max-w-md text-center"><div className="text-5xl mb-4">🌱</div><h1 className="text-2xl font-bold">Profile not found</h1><p className="mt-2 text-stone-500">{error}</p></div></main>;
  if (!data) return <main className="min-h-screen bg-[#f6f4ee] grid place-items-center"><div className="h-9 w-9 rounded-full border-2 border-stone-200 border-t-emerald-700 animate-spin" /></main>;

  const unsafe = data.safety.status !== 'clear';
  return (
    <main className="min-h-screen bg-[#f6f4ee] text-stone-900 selection:bg-emerald-100">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f6f4ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-900 text-white"><Leaf size={17} /></span>CocoaTrace</div>
          <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${unsafe ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
            {unsafe ? `${data.safety.status.toUpperCase()} NOTICE` : 'NO ACTIVE RECALL'}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {unsafe && data.safety.activeRecalls.map((recall) => (
          <section key={recall.id} className="mb-6 overflow-hidden rounded-2xl border border-amber-300 bg-amber-50 shadow-sm">
            <div className="flex gap-3 p-5"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" />
              <div><div className="text-xs font-bold uppercase tracking-widest text-amber-700">Active product notice · {recall.reference_code}</div><h2 className="mt-1 text-xl font-bold">{recall.title}</h2><p className="mt-2 text-sm text-amber-950/80">{recall.reason}</p><div className="mt-4 rounded-xl bg-white/70 p-3 text-sm font-semibold text-amber-950">{recall.instructions}</div><p className="mt-3 text-xs text-amber-800">Issued by {recall.issued_by} · {formatDate(recall.initiated_at)}</p></div>
            </div>
          </section>
        ))}

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="h-24 bg-gradient-to-br from-emerald-900 via-emerald-800 to-lime-700" />
              <div className="px-5 pb-5">
                <div className="-mt-10 grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-amber-100 text-4xl shadow-sm">🍫</div>
                <div className="mt-3 flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold leading-tight">{data.profile.displayName}</h1><p className="mt-1 text-sm text-stone-400">@{data.profile.slug}</p></div><ShieldCheck className="shrink-0 text-emerald-700" size={22} /></div>
                {data.profile.brandName && <p className="mt-3 text-sm font-semibold text-stone-700">{data.profile.brandName}</p>}
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{data.profile.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-stone-100 px-2.5 py-1 font-mono">LOT {data.profile.lotCode}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">{data.product.organicClaimStatus.replace(/_/g, ' ')}</span></div>
                <div className="mt-5 border-t border-stone-100 pt-4 text-xs text-stone-500"><span className="inline-flex items-center gap-1.5"><MapPin size={13} />{data.origin.region}, {data.origin.country}</span><span className="mt-2 flex items-center gap-1.5"><Sprout size={13} />Harvested {formatDate(data.product.harvestDate)}</span></div>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 border-b border-stone-100">
              <div className="p-4 text-center"><div className="text-lg font-bold">{data.origin.plot_count}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Farm plots</div></div>
              <div className="border-x border-stone-100 p-4 text-center"><div className="text-lg font-bold">{Number(data.origin.total_area_hectares).toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Hectares</div></div>
              <div className="p-4 text-center"><div className="text-lg font-bold">{data.journey.length}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Trace events</div></div>
            </div>
            <nav className="flex border-b border-stone-100 px-5">
              {(['journey', 'proof'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`mr-6 border-b-2 py-4 text-sm font-semibold capitalize ${tab === item ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-stone-400'}`}>{item}</button>)}
            </nav>

            <div className="p-5 sm:p-7">
              {tab === 'journey' ? <>
                <div className="mb-6"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Farm to fork</div><h2 className="mt-1 text-2xl font-bold">This product's journey</h2><p className="mt-2 text-sm text-stone-500">Events are shown in time order. Verified entries are backed by an authenticated supply-chain record.</p></div>
                {data.journey.map((event, index) => <EventCard key={`${event.type}-${event.occurredAt}-${index}`} event={event} last={index === data.journey.length - 1} />)}
              </> : <>
                <div className="mb-6"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Evidence</div><h2 className="mt-1 text-2xl font-bold">Claims with receipts</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 p-4"><ShieldCheck className="text-emerald-700" /><h3 className="mt-3 font-bold">Origin verified</h3><p className="mt-1 text-sm text-stone-500">{data.origin.farmName} · {data.origin.officialTraceabilityId || 'Platform identity'}</p><p className="mt-3 text-xs text-stone-400">Geolocation {data.origin.geolocation_complete ? 'complete' : 'requires review'} · EUDR cutoff {data.origin.eudr_cutoff_checked ? 'checked' : 'not complete'}</p></div>
                  {data.certificate && <div className="rounded-xl border border-stone-200 p-4"><FileCheck2 className="text-emerald-700" /><h3 className="mt-3 font-bold">{data.certificate.standard.replace(/_/g, ' ')}</h3><p className="mt-1 text-sm text-stone-500">{data.certificate.certifier_name}</p><p className="mt-3 text-xs text-stone-400">Reference {data.certificate.accreditation_reference}</p></div>}
                </div>
                <div className="mt-5 space-y-2">{data.evidence.map((item) => <div key={item.sha256_hash} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3"><FileCheck2 size={18} className="shrink-0 text-emerald-700" /><div className="min-w-0"><div className="truncate text-sm font-semibold">{item.claim_description || item.file_name}</div><div className="truncate font-mono text-[10px] text-stone-400">{item.sha256_hash}</div></div></div>)}</div>
              </>}
            </div>
          </section>
        </div>
        <footer className="py-8 text-center text-xs text-stone-400"><p>Live product record · Safety checked {new Date(data.safety.checkedAt).toLocaleTimeString()}</p><p className="mt-1">CocoaTrace shows recorded evidence; it does not replace regulator or manufacturer recall instructions.</p></footer>
      </div>
    </main>
  );
}
