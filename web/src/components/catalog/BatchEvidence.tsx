import { useEffect, useState } from 'react';
import { evidence } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { StatusBadge } from '../shared/helpers';
import { useCatalogPage } from './useCatalogPage';
import { useCollectionCount } from './useCollectionCount';
import PageNavigation from './PageNavigation';
export default function BatchEvidence({ batchId }: { batchId: string }) {
  const { canDo } = useAuthCtx();
  return canDo('evidence.read') ? (
    <EvidencePanel key={batchId} batchId={batchId} />
  ) : (
    <p>Evidence records are unavailable with your access.</p>
  );
}
function EvidencePanel({ batchId }: { batchId: string }) {
  const [search, setSearch] = useState(''),
    [version, setVersion] = useState(0);
  const parameters = { entityType: 'batch', entityId: batchId };
  const page = useCatalogPage(evidence.page, { ...parameters, search, limit: '50' });
  const total = useCollectionCount(() => evidence.summary(parameters), batchId, version);
  const refresh = () => {
    page.refresh();
    setVersion((value) => value + 1);
  };
  useEffect(() => {
    const refresh = () => {
      page.refresh();
      setVersion((value) => value + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [page.refresh]);
  return (
    <section
      aria-label="Batch evidence records"
      className="bg-surface border border-border rounded p-5"
    >
      <h3>
        Evidence — {total.count === null ? 'total unavailable' : `${total.count} recorded items`}
      </h3>
      <p className="text-xs text-text-muted">
        Metadata counts are not approval or malware clearance. Downloads retain their independent
        access and scan checks.
      </p>
      <input
        aria-label="Search batch evidence"
        maxLength={80}
        className="form-input my-3"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {total.error && <p role="alert">Evidence {total.error}</p>}
      {page.loading ? (
        <p role="status">Loading evidence…</p>
      ) : page.error ? (
        <p role="alert">Batch evidence unavailable. {page.error}</p>
      ) : (
        <div className="space-y-2">
          {page.items.map((item) => (
            <div
              key={item.id}
              className="bg-surface-darker border border-border rounded p-3 text-xs"
            >
              <strong>{item.file_name}</strong>
              <p>
                {item.type.replace(/_/g, ' ')} · Review: <StatusBadge status={item.review_status} />
              </p>
            </div>
          ))}
          {!page.items.length && <p>No evidence matches this batch and search.</p>}
        </div>
      )}
      <button className="btn" disabled={page.loading} onClick={refresh}>
        Retry batch evidence
      </button>
      <PageNavigation label="batch evidence" page={page} />
    </section>
  );
}
