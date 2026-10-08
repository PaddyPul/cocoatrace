import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileCheck2,
  PackageSearch,
  QrCode,
  Search,
} from 'lucide-react';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { productProfiles } from '../api';
import { ProductProfileSummary } from '../types';
import { SkeletonTable } from '../components/shared/Skeleton';

export default function ProductsPage() {
  const { user } = useAuthCtx();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'attention'>('all');
  const [version, setVersion] = useState(0);
  const page = useCatalogPage(productProfiles.page, { search, visibility: filter, limit: '50' });
  const key = JSON.stringify([user?.id, version]);
  const [totals, setTotals] = useState<{
    key: string;
    count: number;
    published_count: number;
    held_count: number;
  } | null>(null);
  const [totalError, setTotalError] = useState('');
  useEffect(() => {
    let active = true;
    setTotals(null);
    setTotalError('');
    productProfiles
      .summary()
      .then((value) => {
        if (
          ![value.count, value.published_count, value.held_count].every(
            (n) => Number.isSafeInteger(n) && n >= 0,
          ) ||
          value.published_count > value.count ||
          value.held_count > value.count
        )
          throw new Error('Invalid product totals');
        if (active) setTotals({ ...value, key });
      })
      .catch(() => {
        if (active) setTotalError('Product totals unavailable. Retry to refresh.');
      });
    return () => {
      active = false;
    };
  }, [key]);
  const refresh = () => {
    page.refresh();
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    const refresh = () => {
      page.refresh();
      setVersion((v) => v + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [page.refresh]);
  const current = totals?.key === key ? totals : null;
  const published = current?.published_count,
    attention = current?.held_count;
  const filtered = page.items,
    loading = page.loading,
    error = page.error;

  return (
    <Layout currentPage="products">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-3xl border border-brand-400/20 bg-[radial-gradient(circle_at_top_right,rgba(109,190,90,.14),transparent_42%),linear-gradient(145deg,#182d22,#111c16)] p-6 sm:p-8">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">
            Product identity cloud
          </div>
          <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Every lot becomes a living product passport.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Manage the public identity buyers and consumers see, the evidence behind its claims, and
            the safety state that follows it through the network.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="badge badge-green">
              <CheckCircle2 size={11} /> {published ?? '—'} published
            </span>
            <span className={`badge ${attention ? 'badge-amber' : 'badge-gray'}`}>
              <AlertTriangle size={11} /> {attention ?? '—'} on safety hold
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Product passports" value={current?.count} icon={QrCode} />
          <Metric
            label="Not published"
            value={current ? current.count - current.published_count : undefined}
            icon={Eye}
          />
          <Metric label="Published" value={published} icon={CheckCircle2} />
          <Metric
            label="Safety holds"
            value={attention}
            icon={AlertTriangle}
            warn={(attention ?? 0) > 0}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              aria-label="Search product profiles"
              maxLength={80}
              className="form-input pl-9"
              placeholder="Search products, lots, farms or regions…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex rounded-xl bg-surface-darker p-1">
            {(['all', 'published', 'attention'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold capitalize transition ${filter === item ? 'bg-surface-light text-white shadow' : 'text-text-muted hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {totalError && <p role="alert">{totalError}</p>}
      <button className="btn mt-3" onClick={refresh} disabled={loading}>
        Retry product profiles
      </button>
      {loading ? (
        <div className="mt-5">
          <SkeletonTable rows={4} cols={4} />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-400"
        >
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-border p-12 text-center">
          <PackageSearch className="mx-auto text-text-muted" />
          <h3 className="mt-3 font-semibold">No products found</h3>
          <p className="mt-1 text-xs text-text-muted">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      )}
      <PageNavigation label="product profiles" page={page} />
    </Layout>
  );
}

function ProductCard({ item }: { item: ProductProfileSummary }) {
  const unsafe = item.safety_status !== 'clear';
  return (
    <article
      className={`group overflow-hidden rounded-3xl border bg-surface transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/15 ${unsafe ? 'border-amber-300/25' : 'border-border hover:border-brand-400/30'}`}
    >
      <div
        className={`relative h-28 p-5 ${unsafe ? 'bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.25),transparent_45%),linear-gradient(135deg,#3b2a16,#1a211b)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(109,190,90,.25),transparent_45%),linear-gradient(135deg,#193828,#112219)]'}`}
      >
        <div className="flex items-start justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white">
            <QrCode size={21} />
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${unsafe ? 'bg-amber-300/15 text-amber-200' : 'bg-emerald-300/15 text-emerald-200'}`}
          >
            {unsafe ? 'safety hold' : 'no recorded hold'}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{item.display_name}</h3>
            <p className="mt-1 truncate text-xs text-text-muted">
              {item.brand_name || item.current_holder_name}
            </p>
          </div>
          <a
            href={`/p/${item.slug}`}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-text-muted transition hover:border-brand-400/40 hover:text-brand-300"
          >
            <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
          <Field label="Lot" value={item.lot_code} mono />
          <Field
            label="Origin"
            value={[item.region, item.country].filter(Boolean).join(', ') || 'Origin not recorded'}
          />
          <Field label="Evidence" value={`${item.evidence_count} recorded`} icon={FileCheck2} />
          <Field label="Scans" value={Number(item.scan_count).toLocaleString()} icon={Eye} />
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span
            className={`badge ${item.visibility === 'published' ? 'badge-green' : 'badge-gray'}`}
          >
            {item.visibility}
          </span>
          <span className="text-[10px] text-text-muted">
            {Number(item.quantity_kg).toLocaleString()} kg · {item.crop}
          </span>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  warn = false,
}: {
  label: string;
  value?: number;
  icon: typeof QrCode;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <Icon size={16} className={warn ? 'text-amber-300' : 'text-brand-400'} />
      <div className="mt-3 font-mono text-2xl font-bold">
        {value === undefined ? '—' : value.toLocaleString()}
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: typeof Eye;
}) {
  return (
    <div className="rounded-xl bg-surface-darker p-3">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-text-muted">
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className={`mt-1 truncate text-[11px] text-text-secondary ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
