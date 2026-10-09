import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sprout,
  Truck,
  UsersRound,
} from 'lucide-react';
import { publicProducts } from '../../api';
import type { JourneyEvent } from '../../types';
import { useCatalogPage } from './useCatalogPage';
const eventIcons = {
  harvest: Sprout,
  verification: ShieldCheck,
  custody: UsersRound,
  shipment: Truck,
  recall: AlertTriangle,
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        date,
      )
    : 'Date not recorded';
}
function EventCard({ event, last }: { event: JourneyEvent; last: boolean }) {
  const Icon = eventIcons[event.type] || PackageCheck;
  return (
    <div className="relative flex gap-4 pb-7">
      {!last && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-emerald-900/20" />}
      <div
        className={`relative z-10 h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${event.type === 'recall' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-stone-900 capitalize">{event.title}</h3>
          {event.verified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <CheckCircle2 size={12} /> recorded
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-stone-600">{event.summary}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-400">
          <span>{formatDate(event.occurredAt)}</span>
          {event.organization && <span>{event.organization}</span>}
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicJourneyPanel({ slug }: { slug: string }) {
  const [search, setSearch] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const requestVersion = useRef(0);
  const records = useCatalogPage<JourneyEvent & { id: string }>(
    async (parameters) => {
      const version = ++requestVersion.current;
      const page = await publicProducts.journeyPage(
        slug,
        Object.fromEntries(Object.entries(parameters).filter(([name]) => name !== 'slug')),
      );
      if (
        !Number.isSafeInteger(page.count) ||
        page.count < 0 ||
        !Array.isArray(page.items) ||
        page.items.length > 100 ||
        page.count < page.items.length ||
        page.items.some(
          (item) =>
            !item ||
            typeof item.id !== 'string' ||
            typeof item.title !== 'string' ||
            typeof item.summary !== 'string' ||
            !Number.isFinite(Date.parse(item.occurredAt)) ||
            !['harvest', 'verification', 'custody', 'shipment', 'recall'].includes(item.type),
        )
      )
        throw new Error('Invalid public journey page. Retry to refresh.');
      if (version === requestVersion.current) setCount(page.count);
      return page;
    },
    { slug, search, limit: '50' },
  );
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') records.refresh();
    };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [records.refresh]);
  return (
    <section aria-label="Public product journey" aria-busy={records.loading}>
      <p className="mb-3 text-sm">
        {records.loading || records.error || count === null
          ? 'Total unavailable'
          : `${count.toLocaleString()} recorded events`}{' '}
        · Page {records.pageNumber}
      </p>
      <label>
        Search journey
        <input
          aria-label="Search journey"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="form-input"
        />
      </label>
      {records.error && <p role="alert">Product journey unavailable. {records.error}</p>}
      <button disabled={records.loading} onClick={records.refresh}>
        Retry product journey
      </button>
      {records.loading ? (
        <p role="status">Loading recorded events…</p>
      ) : !records.error && records.items.length === 0 ? (
        <p>
          {search ? 'No recorded events match this search.' : 'No journey events are recorded.'}
        </p>
      ) : null}
      <div className="mt-4">
        {records.items.map((event, index) => (
          <EventCard key={event.id} event={event} last={index === records.items.length - 1} />
        ))}
      </div>
      <div className="flex gap-3">
        <button disabled={records.loading || !records.hasPrevious} onClick={records.previous}>
          Previous events
        </button>
        <button disabled={records.loading || !records.hasNext} onClick={records.next}>
          Next events
        </button>
      </div>
    </section>
  );
}
