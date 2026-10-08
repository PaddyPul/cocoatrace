import { useEffect, useState } from 'react';
import { recalls } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { fmtDate, StatusBadge } from '../shared/helpers';
import RecallResponsePanel from '../recalls/RecallResponsePanel';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';
export default function RecallRegister() {
  const { user } = useAuthCtx();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [severity, setSeverity] = useState('all');
  const [openResponseId, setOpenResponseId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const page = useCatalogPage(recalls.page, { search, status, severity, limit: '50' });
  const key = JSON.stringify([user?.id, version]);
  const [totals, setTotals] = useState<{ key: string; count: number; active_count: number } | null>(
      null,
    ),
    [totalError, setTotalError] = useState('');
  useEffect(() => {
    let active = true;
    setTotals(null);
    setTotalError('');
    recalls
      .summary()
      .then((value) => {
        if (
          ![value.count, value.active_count].every((n) => Number.isSafeInteger(n) && n >= 0) ||
          value.active_count > value.count
        )
          throw new Error('Invalid recall totals');
        if (active) setTotals({ ...value, key });
      })
      .catch(() => {
        if (active) setTotalError('Recall totals unavailable. Retry to refresh.');
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => setOpenResponseId(null), [search, status, severity, page.pageNumber, user?.id]);
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
  const items = page.items;
  return (
    <section aria-label="Recall register">
      <h2 className="text-base font-semibold">
        Recall notices — {current ? current.count.toLocaleString() : 'total unavailable'} recorded ·{' '}
        {current ? current.active_count.toLocaleString() : '—'} active
      </h2>
      <p className="mt-2 text-xs text-text-muted">
        Totals cover notices you can access. A resolved notice does not automatically release safety
        holds or returned material.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <input
          aria-label="Search recall notices"
          maxLength={80}
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Recall status"
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['all', 'draft', 'active', 'resolved'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Recall severity"
          className="form-select"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {['all', 'advisory', 'warning', 'critical'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="btn" disabled={page.loading} onClick={refresh}>
          Retry recall notices
        </button>
      </div>
      {totalError && <p role="alert">{totalError}</p>}
      {page.loading ? (
        <p role="status">Loading recalls…</p>
      ) : page.error ? (
        <p role="alert">Recall notices unavailable. {page.error}</p>
      ) : !items.length ? (
        <p>No permitted recall notices match these filters.</p>
      ) : (
        <div className="space-y-3">
          {items.map((recall) => (
            <article
              key={recall.id}
              className={`rounded border p-5 ${recall.status === 'active' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-surface'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={recall.status} />
                    <span
                      className={`badge ${recall.severity === 'critical' ? 'badge-red' : recall.severity === 'warning' ? 'badge-amber' : 'badge-blue'}`}
                    >
                      {recall.severity}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">
                      {recall.reference_code}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold">{recall.title}</h2>
                  <p className="mt-1 text-xs text-text-secondary">{recall.reason}</p>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => setOpenResponseId(openResponseId === recall.id ? null : recall.id)}
                >
                  {openResponseId === recall.id ? 'Close response' : 'Open response'}
                </button>
              </div>
              <div className="mt-4 rounded-sm bg-surface-darker p-3 text-xs">
                <span className="font-semibold">Instructions: </span>
                {recall.instructions}
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                {recall.status === 'active'
                  ? 'Affected material is on hold. Follow the instructions above; new offers, dispatch and custody transfers are blocked.'
                  : recall.status === 'resolved'
                    ? 'This notice is resolved. Withdrawn listings remain unpublished. Review recorded recovery and remaining safety holds before republishing eligible material; returned or destroyed stock stays blocked.'
                    : 'Draft notice. This status does not establish safety clearance. Follow manager instructions and review any recorded holds.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-text-muted">
                <span>
                  {recall.affected_lot_count} affected lot
                  {recall.affected_lot_count === 1 ? '' : 's'}
                </span>
                <span>
                  {recall.batch_count} source batch{recall.batch_count === 1 ? '' : 'es'}
                </span>
                <span>Issued by {recall.issued_by}</span>
                <span>{fmtDate(recall.initiated_at)}</span>
              </div>
              {openResponseId === recall.id && (
                <RecallResponsePanel
                  recallId={recall.id}
                  onChanged={() => {
                    void refresh();
                  }}
                />
              )}
            </article>
          ))}
        </div>
      )}
      <PageNavigation label="recall notices" page={page} />
    </section>
  );
}
