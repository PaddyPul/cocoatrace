import { useCallback, useEffect, useRef, useState } from 'react';
import { publicProducts } from '../../api';
import type { PublicNotice, PublicNoticeSafety } from '../../types';
import { useCatalogPage } from './useCatalogPage';
export function validNoticeSafety(value: PublicNoticeSafety, count: number) {
  if (
    !value ||
    typeof value.inventoryHeld !== 'boolean' ||
    !['clear', 'advisory', 'warning', 'critical'].includes(value.status) ||
    !Number.isFinite(Date.parse(value.checkedAt))
  )
    return false;
  const counts = [
    value.activeCount,
    value.resolvedCount,
    value.criticalCount,
    value.warningCount,
    value.advisoryCount,
  ];
  if (
    counts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    value.activeCount + value.resolvedCount !== count ||
    value.criticalCount + value.warningCount + value.advisoryCount !== value.activeCount
  )
    return false;
  const expected = value.criticalCount
    ? 'critical'
    : value.warningCount
      ? 'warning'
      : value.advisoryCount
        ? 'advisory'
        : value.inventoryHeld
          ? 'warning'
          : 'clear';
  return expected === value.status;
}
export default function PublicNoticesPanel({
  slug,
  onSafety,
}: {
  slug: string;
  onSafety: (safety: PublicNoticeSafety | null) => void;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('active');
  const [aggregate, setAggregate] = useState<{ count: number; safety: PublicNoticeSafety } | null>(
    null,
  );
  const version = useRef(0);
  const fetch = useCallback(
    async (parameters: Record<string, string>) => {
      const current = ++version.current;
      const page = await publicProducts.noticesPage(
        slug,
        Object.fromEntries(Object.entries(parameters).filter(([name]) => name !== 'slug')),
      );
      if (
        !Number.isSafeInteger(page.count) ||
        page.count < 0 ||
        !Array.isArray(page.items) ||
        page.items.length > 100 ||
        page.count < page.items.length ||
        !validNoticeSafety(page.safety, page.count) ||
        page.items.some(
          (item) =>
            !item ||
            typeof item.id !== 'string' ||
            typeof item.title !== 'string' ||
            typeof item.reason !== 'string' ||
            typeof item.instructions !== 'string' ||
            typeof item.reference_code !== 'string' ||
            typeof item.issued_by !== 'string' ||
            !['active', 'resolved'].includes(item.status) ||
            !['advisory', 'warning', 'critical'].includes(item.severity) ||
            !Number.isFinite(Date.parse(item.initiated_at)),
        ) ||
        typeof page.hasMore !== 'boolean' ||
        page.hasMore !== (typeof page.nextCursor === 'string' && page.nextCursor.length > 0) ||
        (!page.hasMore && page.nextCursor !== null)
      )
        throw new Error('Invalid public notice page. Retry to refresh.');
      if (current === version.current) setAggregate({ count: page.count, safety: page.safety });
      return page;
    },
    [slug],
  );
  const records = useCatalogPage<PublicNotice>(fetch, { slug, search, status, limit: '50' });
  useEffect(() => {
    onSafety(records.loading || records.error ? null : aggregate?.safety || null);
  }, [records.loading, records.error, aggregate, onSafety]);
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
    <section
      aria-label="Public product notices"
      aria-busy={records.loading}
      className="mb-6 rounded-2xl border border-stone-200 bg-white p-5"
    >
      <h2 className="text-xl font-bold">Product safety notices</h2>
      <p className="my-3 text-sm">
        {records.loading || records.error || !aggregate
          ? 'Notice totals unavailable'
          : `${aggregate.count.toLocaleString()} recorded · ${aggregate.safety.activeCount.toLocaleString()} active · ${aggregate.safety.resolvedCount.toLocaleString()} resolved`}{' '}
        · Page {records.pageNumber}
      </p>
      <p className="mb-3 text-sm">
        The safety status covers all related notices and retained inventory holds, including records
        outside this page or filter.
      </p>
      <label>
        Notice status
        <select
          aria-label="Notice status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="form-select"
        >
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="all">All notices</option>
        </select>
      </label>
      <label>
        Search safety notices
        <input
          aria-label="Search safety notices"
          maxLength={80}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input"
        />
      </label>
      {records.error && <p role="alert">Product notices unavailable. {records.error}</p>}
      <button disabled={records.loading} onClick={records.refresh}>
        Retry product notices
      </button>
      {records.loading ? (
        <p role="status">Checking product safety notices…</p>
      ) : !records.error && !records.items.length ? (
        <p>No notices match this view. Consult the full safety status above.</p>
      ) : null}
      {records.items.map((notice) => (
        <article
          key={notice.id}
          className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-xs uppercase">
            {notice.status === 'active' ? 'Active' : 'Resolved'} product notice ·{' '}
            {notice.reference_code}
          </p>
          <h3 className="mt-1 font-bold">{notice.title}</h3>
          <p className="mt-2 text-sm">{notice.reason}</p>
          <p className="mt-3 font-semibold">{notice.instructions}</p>
          <p className="mt-2 text-xs">
            Issued by {notice.issued_by} · {new Date(notice.initiated_at).toLocaleDateString('en')}
          </p>
        </article>
      ))}
      <div className="flex gap-3">
        <button disabled={records.loading || !records.hasPrevious} onClick={records.previous}>
          Previous notices
        </button>
        <button disabled={records.loading || !records.hasNext} onClick={records.next}>
          Next notices
        </button>
      </div>
    </section>
  );
}
