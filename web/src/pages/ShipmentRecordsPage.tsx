import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipments, type ShipmentSummary } from '../api';
import Layout from '../components/layout/Layout';
import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
export default function ShipmentRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [status, setStatus] = useState('all');
  const page = useCatalogPage(shipments.page, { search, direction, status });
  const [summary, setSummary] = useState<ShipmentSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      shipments
        .summary()
        .then((row) => {
          if (
            !row ||
            !['count', 'active_count', 'delivered_count', 'cancelled_count'].every(
              (key) =>
                Number.isInteger(row[key as keyof ShipmentSummary]) &&
                Number(row[key as keyof ShipmentSummary]) >= 0,
            )
          )
            throw new Error('Invalid transport totals');
          if (active) {
            setSummary(row);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) {
            setSummary(null);
            setFailed(true);
          }
        });
    load();
    const focus = () => {
      page.refresh();
      load();
    };
    window.addEventListener('focus', focus);
    return () => {
      active = false;
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  return (
    <Layout currentPage="shipments">
      <p className="mb-3 text-sm">
        Total transport records: {summary?.count ?? 'Unavailable'} · Active transport:{' '}
        {summary?.active_count ?? 'Unavailable'}
      </p>
      {failed && (
        <p role="alert">
          Transport totals could not be refreshed.{' '}
          <button className="btn" onClick={() => setRefresh((n) => n + 1)}>
            Retry transport totals
          </button>
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-3">
        <input
          aria-label="Search shipments"
          className="form-input"
          maxLength={80}
          placeholder="Search provider, booking, route or Incoterm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Shipment direction"
          className="form-select"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="all">All my transport records</option>
          <option value="purchases">Purchases</option>
          <option value="sales">Sales</option>
        </select>
        <select
          aria-label="Shipment status"
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['all', 'active', 'delivered', 'cancelled'].map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      {page.loading ? (
        <p role="status">Loading transport records…</p>
      ) : page.error ? (
        <p role="alert">
          {page.error}{' '}
          <button className="btn" onClick={page.refresh}>
            Retry shipments
          </button>
        </p>
      ) : (
        <div className="table-wrap">
          <p className="text-xs text-text-muted">
            {page.items.length} transport records on this page
          </p>
          {!page.items.length ? (
            <p>
              {search || status !== 'all' || direction !== 'all'
                ? 'No transport records match these filters.'
                : 'No transport records on this page. Accepted offers create shared transport workspaces.'}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Transport</th>
                  <th>External provider</th>
                  <th>Coordinator</th>
                  <th>Incoterm</th>
                  <th>Route</th>
                  <th>ETA</th>
                  <th>Document</th>
                  <th>Milestone</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((sh) => (
                  <tr key={sh.id}>
                    <td>
                      <button
                        className="btn"
                        aria-label={`Open transport ${sh.id}`}
                        onClick={() => navigate(`/shipments/${sh.id}`)}
                      >
                        {sh.id.slice(0, 8)}…
                      </button>
                    </td>
                    <td>{sh.service_provider_name || 'Not arranged'}</td>
                    <td>{sh.transport_coordinator_name || 'Not recorded'}</td>
                    <td>{sh.incoterm || 'Not recorded'}</td>
                    <td>
                      {sh.origin_port || 'Not recorded'} → {sh.destination_port || 'Not recorded'}
                    </td>
                    <td>{fmtDate(sh.eta_arrival)}</td>
                    <td>{sh.transport_document_reference || 'Not recorded'}</td>
                    <td>
                      <StatusBadge status={sh.current_milestone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <PageNavigation page={page} label="shipments" />
    </Layout>
  );
}
