import { useEffect, useState } from 'react';
import { certificates } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { StatusBadge, fmtDate } from '../shared/helpers';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';
export default function FarmCertificates({ farmId }: { farmId: string }) {
  const { canDo } = useAuthCtx();
  return canDo('certificate.read') ? (
    <CertificatePanel key={farmId} farmId={farmId} />
  ) : (
    <p>Certificate records are unavailable with your access.</p>
  );
}
function CertificatePanel({ farmId }: { farmId: string }) {
  const [search, setSearch] = useState('');
  const page = useCatalogPage(certificates.page, { farmId, search, limit: '50' });
  const [count, setCount] = useState<number | null>(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setCount(null);
    setError('');
    certificates
      .summary({ farmId })
      .then((value) => {
        if (!Number.isSafeInteger(value.count) || value.count < 0)
          throw new Error('Invalid certificate total');
        if (active) setCount(value.count);
      })
      .catch(() => {
        if (active) setError('Farm certificate total unavailable.');
      });
    return () => {
      active = false;
    };
  }, [farmId, version]);
  const refresh = () => {
    page.refresh();
    setVersion((n) => n + 1);
  };
  useEffect(() => {
    const refresh = () => {
      page.refresh();
      setVersion((n) => n + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [page.refresh]);
  return (
    <section
      className="bg-surface border border-border rounded p-5"
      aria-label="Farm certificate records"
    >
      <h3 className="text-sm font-semibold">
        Certificates — {count === null ? 'total unavailable' : `${count} accessible records`}
      </h3>
      <p className="text-xs text-text-muted">
        Recorded status is not proof of current validity or issuer accreditation.
      </p>
      <input
        aria-label="Search farm certificates"
        maxLength={80}
        className="form-input my-3"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      {page.loading ? (
        <p role="status">Loading farm certificates…</p>
      ) : page.error ? (
        <p role="alert">Farm certificates unavailable. {page.error}</p>
      ) : (
        <div className="space-y-2">
          {page.items.map((c) => (
            <div key={c.id} className="bg-surface-darker border border-border rounded p-3 text-xs">
              <span>{c.standard}</span> <StatusBadge status={c.status} />
              <p>
                {fmtDate(c.valid_from)} → {fmtDate(c.valid_to)}
              </p>
            </div>
          ))}
          {!page.items.length && (
            <p>No certificates match this farm and search with your access.</p>
          )}
        </div>
      )}
      <button className="btn" disabled={page.loading} onClick={refresh}>
        Retry farm certificates
      </button>
      <PageNavigation label="farm certificates" page={page} />
    </section>
  );
}
