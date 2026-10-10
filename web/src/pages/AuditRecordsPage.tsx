import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { audit } from '../api';
import { AuditEvent } from '../types';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
const entityRoutes: Record<string, string> = {
  harvest_batch: '/batches',
  sales_contract: '/contracts',
  shipment: '/shipments',
  payment_request: '/payments',
  trade_offer: '/contracts',
  listing: '/marketplace',
  organic_certificate: '/certs',
  farm: '/farms',
  batch_holding: '/holdings',
  custody_transfer: '/holdings',
  evidence_item: '/evidence',
};
export default function AuditRecordsPage() {
  const navigate = useNavigate(),
    { canDo } = useAuthCtx();
  const [search, setSearch] = useState(''),
    [entityType, setEntityType] = useState(''),
    [entityId, setEntityId] = useState(''),
    [action, setAction] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [count, setCount] = useState<number | null>(null);
  const requestVersion = useRef(0);
  const fetch = useCallback(async (parameters: Record<string, string>) => {
    const version = ++requestVersion.current;
    const result = await audit.page(parameters);
    if (
      !Number.isSafeInteger(result.count) ||
      result.count < 0 ||
      !Array.isArray(result.items) ||
      result.items.length > 100 ||
      result.count < result.items.length ||
      result.items.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          typeof row.action !== 'string' ||
          typeof row.entity_type !== 'string' ||
          typeof row.entity_id !== 'string' ||
          !(row.actor_user_id === null || typeof row.actor_user_id === 'string') ||
          !(
            row.new_state_hash === undefined ||
            row.new_state_hash === null ||
            typeof row.new_state_hash === 'string'
          ) ||
          !Number.isFinite(Date.parse(row.occurred_at)),
      )
    )
      throw new Error('Invalid audit page response. Retry to refresh.');
    if (version === requestVersion.current) setCount(result.count);
    return result;
  }, []);
  const page = useCatalogPage<AuditEvent>(fetch, { ...filters, search, limit: '50' });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') page.refresh();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [page.refresh]);
  return (
    <Layout currentPage="audit">
      <section
        aria-label="Audit register"
        className="table-wrap space-y-4"
        aria-busy={page.loading}
      >
        <h2 className="text-base font-semibold">
          Audit events —{' '}
          {page.loading || page.error || count === null
            ? 'total unavailable'
            : count.toLocaleString()}{' '}
          recorded
        </h2>
        <p className="text-xs text-text-muted">
          Totals cover the complete permitted history and applied exact filters. Search finds
          records across all pages. Routine browsing shows record references, not event metadata.
        </p>
        <label>
          Search audit log
          <input
            aria-label="Search audit log"
            maxLength={80}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            placeholder="Action, entity, reference or reason"
          />
        </label>
        <form
          aria-label="Audit exact filters"
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({
              ...(entityType ? { entityType } : {}),
              ...(entityId ? { entityId } : {}),
              ...(action ? { action } : {}),
            });
          }}
        >
          <label>
            Entity type
            <input
              aria-label="Audit entity type"
              maxLength={80}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="form-input"
            />
          </label>
          <label>
            Entity ID
            <input
              aria-label="Audit entity ID"
              maxLength={36}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="form-input"
            />
          </label>
          <label>
            Action
            <input
              aria-label="Audit action"
              maxLength={80}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="form-input"
            />
          </label>
          <div className="flex gap-2 items-end">
            <button className="btn btn-sm" type="submit">
              Apply audit filters
            </button>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => {
                setEntityType('');
                setEntityId('');
                setAction('');
                setFilters({});
              }}
            >
              Clear audit filters
            </button>
          </div>
        </form>
        {canDo('audit.export') && (
          <button
            className="btn btn-sm"
            onClick={() =>
              window.open(
                audit.export(
                  filters.entityType && filters.entityId
                    ? { entityType: filters.entityType, entityId: filters.entityId }
                    : {},
                ),
                '_blank',
              )
            }
          >
            {filters.entityType && filters.entityId
              ? 'Export entity history'
              : 'Export complete log'}
          </button>
        )}
        {canDo('audit.export') && (
          <p className="text-xs text-text-muted">
            Downloads include the complete permitted log, or the paired entity type and ID when both
            are applied. Search and action filters do not change downloads. Complete reports are
            limited to 1,000 records and 4 MiB; narrow both entity fields for larger histories.
          </p>
        )}
        {page.loading ? (
          <p role="status">Loading audit events…</p>
        ) : page.error ? (
          <div role="alert">
            <p>Audit events unavailable. {page.error}</p>
            <button className="btn btn-sm" onClick={page.refresh}>
              Retry audit events
            </button>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Hash</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.occurred_at).toLocaleString()}</td>
                    <td>{row.action}</td>
                    <td>
                      {row.entity_type}/{row.entity_id.slice(0, 8)}
                    </td>
                    <td>
                      {row.actor_user_id
                        ? `${row.actor_user_id.slice(0, 8)}…`
                        : 'System / actor unavailable'}
                    </td>
                    <td>
                      {row.new_state_hash ? `${row.new_state_hash.slice(0, 20)}…` : 'Not recorded'}
                    </td>
                    <td>
                      {entityRoutes[row.entity_type] ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => navigate(entityRoutes[row.entity_type])}
                        >
                          View record
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!page.items.length && (
              <p>
                {search || Object.keys(filters).length
                  ? 'No audit events match these filters.'
                  : 'No audit events are recorded for this scope.'}
              </p>
            )}
          </>
        )}
        <PageNavigation page={page} label="audit events" />
      </section>
    </Layout>
  );
}
