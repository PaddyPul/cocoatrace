import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useNavigationLanguage as useLanguage } from '../navigation/useNavigationLanguage';
import { sourcing } from '../api';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';

export default function SourcingRequestsPage() {
  const { canDo } = useAuthCtx();
  const { t } = useLanguage();
  if (!canDo('listing.read') || !canDo('offer.create'))
    return (
      <Layout currentPage="sourcing-requests">
        <p role="alert">{t('nav.requests-denied')}</p>
      </Layout>
    );
  return <RequestRegister />;
}
function RequestRegister() {
  const { t } = useLanguage();
  const { user } = useAuthCtx();
  const fetch = useCallback(
    async (parameters: Record<string, string>) => {
      const result = await sourcing.page(parameters);
      if (result.items.some((row) => row.buyer_organization_id !== user?.organizationId))
        throw new Error('Unexpected request scope');
      return result;
    },
    [user?.organizationId],
  );
  const [search, setSearch] = useState('');
  const page = useCatalogPage(fetch, { mine: 'true', search });
  return (
    <Layout currentPage="sourcing-requests">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-2xl font-semibold">{t('nav.sourcing-requests')}</h2>
        <Link className="btn btn-primary" to="/source/new">
          {t('nav.create-request')}
        </Link>
      </div>
      <label className="block mb-4 text-sm">
        {t('nav.search-requests')}
        <input
          className="form-input mt-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {page.loading && <p role="status">{t('nav.loading-requests')}</p>}
      {page.error && (
        <div role="alert">
          <p>{t('nav.requests-failed')}</p>
          <button className="btn mt-2" onClick={page.refresh}>
            {t('nav.retry-requests')}
          </button>
        </div>
      )}
      {!page.loading && !page.error && !page.items.length && <p>{t('nav.no-requests')}</p>}
      <div className="space-y-3">
        {page.items.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-semibold">{row.title}</h3>
            <p className="my-2 text-sm text-text-muted">
              {row.commodity} · {Number(row.quantity_kg).toLocaleString()} kg ·{' '}
              {row.delivery_location} · {row.incoterm}
            </p>
            <p className="mb-3 text-xs">{t(`request-status.${row.status}`, row.status)}</p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn" to={`/source/new?request=${encodeURIComponent(row.id)}`}>
                {t('nav.review-request')}
              </Link>
              {row.status === 'open' && (
                <Link
                  className="btn btn-primary"
                  to={`/marketplace?request=${encodeURIComponent(row.id)}`}
                >
                  {t('nav.find-matches')}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <PageNavigation page={page} label={t('nav.sourcing-requests')} />
    </Layout>
  );
}
