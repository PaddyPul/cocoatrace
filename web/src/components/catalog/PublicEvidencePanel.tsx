import { useEffect, useRef, useState } from 'react';
import { publicProducts } from '../../api';
import { useCatalogPage } from './useCatalogPage';
import type { PublicProduct } from '../../types';
export default function PublicEvidencePanel({ slug }: { slug: string }) {
  const [search, setSearch] = useState('');
  const requestVersion = useRef(0);
  const [count, setCount] = useState<number | null>(null);
  const records = useCatalogPage<PublicProduct['evidence'][number]>(
    async (parameters) => {
      const version = ++requestVersion.current;
      const page = await publicProducts.evidencePage(
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
            typeof item.file_name !== 'string' ||
            typeof item.sha256_hash !== 'string' ||
            item.review_status !== 'approved',
        )
      )
        throw new Error('Invalid public evidence page. Retry to refresh.');
      if (version === requestVersion.current) setCount(page.count);
      return page;
    },
    { slug, search, limit: '50' },
  );
  // slug is part of the local read key, never an API query parameter.
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
    <section aria-label="Public reviewed evidence" aria-busy={records.loading}>
      <h3 className="mt-5 font-semibold">Reviewed evidence</h3>
      <p className="text-sm">
        {records.loading || records.error || count === null
          ? 'Total unavailable'
          : `${count.toLocaleString()} reviewed records`}{' '}
        · Page {records.pageNumber}
      </p>
      <label>
        Search reviewed evidence
        <input
          aria-label="Search reviewed evidence"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="form-input"
        />
      </label>
      {records.error && <p role="alert">Reviewed evidence unavailable. {records.error}</p>}
      <button disabled={records.loading} onClick={records.refresh}>
        Retry reviewed evidence
      </button>
      {records.loading ? (
        <p role="status">Loading reviewed evidence…</p>
      ) : !records.error && records.items.length === 0 ? (
        <p>
          {search
            ? 'No reviewed evidence matches this search.'
            : 'No publishable reviewed evidence is recorded.'}
        </p>
      ) : null}
      <div className="mt-5 space-y-2">
        {records.items.map((item) => (
          <div key={item.id} className="rounded-xl bg-stone-50 p-3">
            <div className="text-sm font-semibold">{item.claim_description || item.file_name}</div>
            <div className="font-mono text-[10px] text-stone-400">{item.sha256_hash}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <button disabled={records.loading || !records.hasPrevious} onClick={records.previous}>
          Previous evidence
        </button>
        <button disabled={records.loading || !records.hasNext} onClick={records.next}>
          Next evidence
        </button>
      </div>
    </section>
  );
}
