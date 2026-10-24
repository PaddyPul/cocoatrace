import { useState } from 'react';
import { useRegisterSummary } from '../components/catalog/useRegisterSummary';
import { useNavigate } from 'react-router-dom';
import { payments, type PaymentSummary } from '../api';
import Layout from '../components/layout/Layout';
import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import { StatusBadge, fmtMoney } from '../components/shared/helpers';
const summaryCounts = [
  'count',
  'open_count',
  'settled_count',
  'cancelled_count',
] as const satisfies readonly (keyof PaymentSummary)[];
export default function PaymentRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [status, setStatus] = useState('all');
  const [currency, setCurrency] = useState('');
  const page = useCatalogPage(payments.page, { search, direction, status, currency });
  const { summary, failed, retry } = useRegisterSummary(
    payments.summary,
    summaryCounts,
    page.refresh,
  );
  return (
    <Layout currentPage="payments">
      <p className="mb-3 text-sm">
        Total payment workflows: {summary?.count ?? 'Unavailable'} · Open workflows:{' '}
        {summary?.open_count ?? 'Unavailable'}
      </p>
      {failed && (
        <p role="alert">
          Payment totals could not be refreshed.{' '}
          <button className="btn" onClick={retry}>
            Retry payment totals
          </button>
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-3">
        <input
          aria-label="Search payments"
          className="form-input"
          maxLength={80}
          placeholder="Search contract, reference, plan or currency"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Payment direction"
          className="form-select"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="all">All my payment workflows</option>
          <option value="purchases">Purchases</option>
          <option value="sales">Sales</option>
        </select>
        <select
          aria-label="Payment status"
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[
            'all',
            'open',
            'awaiting_terms',
            'awaiting_security',
            'awaiting_delivery',
            'awaiting_documents',
            'payment_due',
            'payment_pending_verification',
            'partially_paid',
            'settled',
            'cancelled',
          ].map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          aria-label="Payment currency"
          className="form-select"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="">All currencies</option>
          {['EUR', 'USD', 'GHS', 'GBP', 'JPY'].map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Totals cover all your workflows, independent of filters. Open excludes settled or cancelled
        contracts. Amounts are displayed in each workflow's currency; currencies are not added
        together.
      </p>
      {page.loading ? (
        <p role="status">Loading payment workflows…</p>
      ) : page.error ? (
        <p role="alert">
          {page.error}{' '}
          <button className="btn" onClick={page.refresh}>
            Retry payments
          </button>
        </p>
      ) : (
        <div className="table-wrap">
          <p className="text-xs text-text-muted">
            {page.items.length} payment workflows on this page
          </p>
          {!page.items.length ? (
            <p>
              {search || currency || status !== 'all' || direction !== 'all'
                ? 'No payment workflows match these filters.'
                : 'No payment workflows on this page. Accepted offers create payment workflows. Open a deal to configure or confirm payment terms.'}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Contract</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="btn"
                        aria-label={`Open payment ${p.id}`}
                        onClick={() => navigate(`/payments/${p.id}`)}
                      >
                        {p.id.slice(0, 8)}…
                      </button>
                    </td>
                    <td>{p.contract_id.slice(0, 8)}…</td>
                    <td>{fmtMoney(p.amount_total, p.currency, p.currency_minor_units)}</td>
                    <td>{p.currency}</td>
                    <td>
                      <StatusBadge domain="payment" status={p.status} />
                    </td>
                    <td>{p.payment_reference_external || 'Not recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <PageNavigation page={page} label="payments" />
    </Layout>
  );
}
