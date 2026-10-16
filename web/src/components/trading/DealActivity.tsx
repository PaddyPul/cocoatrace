import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
type Event = {
  id: string;
  label: string;
  occurredAt: string;
  party: 'buyer' | 'seller' | 'system';
};
type History = { items: Event[]; hasMore: boolean; nextCursor: string | null };
function history(value: unknown): History {
  const page = value as History;
  if (
    !page ||
    !Array.isArray(page.items) ||
    page.items.length > 50 ||
    typeof page.hasMore !== 'boolean' ||
    (page.nextCursor !== null && typeof page.nextCursor !== 'string') ||
    page.hasMore !== Boolean(page.nextCursor) ||
    page.items.some(
      (row) =>
        !row ||
        typeof row.id !== 'string' ||
        typeof row.label !== 'string' ||
        !row.label ||
        !['buyer', 'seller', 'system'].includes(row.party) ||
        typeof row.occurredAt !== 'string' ||
        !Number.isFinite(Date.parse(row.occurredAt)),
    )
  )
    throw new Error('Deal activity response is unavailable. Retry.');
  return page;
}
export default function DealActivity({ contractId }: { contractId: string }) {
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load(cursor?: string) {
    const request = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = history(
        await api(
          'GET',
          `/contracts/${contractId}/activity/page?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      );
      if (request === generation.current) setPage(result);
    } catch {
      if (request === generation.current) {
        setPage(null);
        setError('Deal activity could not be loaded. Retry to see recorded history.');
      }
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    setPage(null);
    if (opened) void load();
    return () => {
      generation.current++;
    };
  }, [contractId, opened]);
  return (
    <section
      className="rounded border border-border bg-surface p-5 space-y-3"
      aria-label="Deal activity"
    >
      <h3 className="text-sm font-semibold">Deal activity</h3>
      <p className="text-xs text-text-muted">
        Selected recorded payment, transport, delivery and cancellation actions, newest first. Older
        activity may be absent if it was not recorded. This history does not independently verify
        payment or delivery.
      </p>
      {!opened && (
        <button
          type="button"
          className="btn-secondary"
          aria-expanded={false}
          onClick={() => setOpened(true)}
        >
          Show recorded activity
        </button>
      )}
      {opened && (
        <>
          {busy && <p role="status">Loading deal activity…</p>}
          {error && <p role="alert">{error}</p>}
          {!busy && page?.items.length === 0 && (
            <p>No recorded activity available for this deal.</p>
          )}
          {page && (
            <ol className="space-y-2">
              {page.items.map((event) => (
                <li key={event.id} className="text-sm">
                  <strong>{event.label}</strong>
                  <span className="block text-xs text-text-muted">
                    {event.party === 'system'
                      ? 'Platform process'
                      : event.party === 'buyer'
                        ? 'Buyer'
                        : 'Seller'}{' '}
                    ·{' '}
                    <time dateTime={event.occurredAt}>
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh activity
            </button>
            {page?.hasMore && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void load(page.nextCursor!)}
              >
                Older activity
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
