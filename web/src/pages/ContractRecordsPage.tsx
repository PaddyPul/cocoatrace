import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contracts, type ContractSummary } from '../api';
import Layout from '../components/layout/Layout';
import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import { StatusBadge, fmtMoney } from '../components/shared/helpers';
export default function ContractRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [status, setStatus] = useState('all');
  const page = useCatalogPage(contracts.page, { search, direction, status });
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      contracts
        .summary()
        .then((row) => {
          if (
            !row ||
            !['count', 'active_count', 'settled_count', 'cancelled_count'].every(
              (key) =>
                Number.isInteger(row[key as keyof ContractSummary]) &&
                Number(row[key as keyof ContractSummary]) >= 0,
            )
          )
            throw new Error('Invalid order totals');
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
    <Layout currentPage="contracts">
      <p className="mb-3 text-sm">
        Total deals: {summary?.count ?? 'Unavailable'} · Active orders:{' '}
        {summary?.active_count ?? 'Unavailable'}
      </p>
      {failed && (
        <p role="alert">
          Order totals could not be refreshed.{' '}
          <button className="btn" onClick={() => setRefresh((n) => n + 1)}>
            Retry order totals
          </button>
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-3">
        <input
          aria-label="Search contracts"
          className="form-input"
          maxLength={80}
          placeholder="Search deal ID, parties or Incoterm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Contract direction"
          className="form-select"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="all">All my deals</option>
          <option value="purchases">Purchases</option>
          <option value="sales">Sales</option>
        </select>
        <select
          aria-label="Contract status"
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[
            'all',
            'active',
            'accepted',
            'fulfilment_in_progress',
            'in_transit',
            'delivered',
            'delivered_payment_risk',
            'settled',
            'cancelled',
          ].map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      {page.loading ? (
        <p role="status">Loading deals…</p>
      ) : page.error ? (
        <p role="alert">
          {page.error}{' '}
          <button className="btn" onClick={page.refresh}>
            Retry contracts
          </button>
        </p>
      ) : (
        <div className="table-wrap">
          <p className="text-xs text-text-muted">{page.items.length} deals on this page</p>
          {!page.items.length ? (
            <p>
              {search || status !== 'all' || direction !== 'all'
                ? 'No deals match these filters.'
                : 'No deals on this page. Accepted offers create shared deal workspaces.'}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>Quantity (kg)</th>
                  <th>Value</th>
                  <th>Incoterm</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="btn"
                        aria-label={`Open deal ${c.id}`}
                        onClick={() => navigate(`/deal-room/${c.id}`)}
                      >
                        {c.id.slice(0, 8)}…
                      </button>
                    </td>
                    <td>{c.seller_name || '—'}</td>
                    <td>{c.buyer_name || '—'}</td>
                    <td>{Number(c.quantity_kg).toLocaleString()}</td>
                    <td>
                      {c.trade_value == null
                        ? 'Value unavailable'
                        : fmtMoney(Number(c.trade_value), c.currency, c.currency_minor_units)}
                    </td>
                    <td>{c.incoterm}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <PageNavigation page={page} label="contracts" />
    </Layout>
  );
}
