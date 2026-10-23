import { useState } from 'react';
import { Link } from 'react-router-dom';
import { platformFees, type FeeStatement } from '../../api';
import { useCatalogPage } from '../catalog/useCatalogPage';
import PageNavigation from '../catalog/PageNavigation';
import { fmtMoney } from '../shared/helpers';

export function feeTimestamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return `${new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC`;
}
export function FeeRegisterRow({ fee: f }: { fee: FeeStatement['fee'] }) {
  return (
    <Link
      className="block border border-border rounded p-3 space-y-1"
      to={`/platform-fees/${f.contract_id}`}
    >
      <span>
        {f.seller_name} → {f.buyer_name}
      </span>
      <span className="block text-xs">
        {fmtMoney(Number(f.amount_total), f.currency, f.currency_minor_units)} ·{' '}
        {f.refund_status === 'confirmed'
          ? 'Full fee refund confirmed · original paid receipt retained'
          : f.refund_status
            ? `Refund ${f.refund_status} · trade on hold`
            : f.status.split('_').join(' ')}{' '}
        · {f.contract_id}
      </span>
      {Number(f.pending_submission_count) > 0 && (
        <strong className="block text-sm text-amber-300">
          Payment reference submitted — receipt verification pending
        </strong>
      )}
      <span className="block text-xs text-text-muted">Created: {feeTimestamp(f.created_at)}</span>
      <span className="block text-xs text-text-muted">
        Invoiced: {feeTimestamp(f.invoiced_at)} · Latest submission:{' '}
        {feeTimestamp(f.latest_submission_at)} · Receipt verified:{' '}
        {f.receipt_verified ? feeTimestamp(f.paid_at) : 'Not verified'}
      </span>
    </Link>
  );
}
export default function FeeRegister() {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [review, setReview] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const page = useCatalogPage(platformFees.page, { search, status, review, from, to });
  return (
    <section aria-label="Fee register" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          Search fees
          <input
            className="form-input"
            maxLength={80}
            placeholder="Organization, trade ID, fee ID or currency"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Fee status
          <select
            aria-label="Fee status"
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['all', 'estimated', 'invoiced', 'paid', 'written_off', 'cancelled', 'waived'].map(
              (value) => (
                <option key={value} value={value}>
                  {value.split('_').join(' ')}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Receipt review
          <select
            aria-label="Receipt review"
            className="form-select"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          >
            <option value="all">All receipt states</option>
            <option value="pending">Verification pending</option>
          </select>
        </label>
        <label>
          Created from (UTC)
          <input
            type="date"
            className="form-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Created through (UTC)
          <input
            type="date"
            className="form-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <button className="btn" disabled={page.loading} onClick={page.refresh}>
        Refresh fee register
      </button>
      <p className="text-xs text-text-muted">
        Newest first. Search and filters cover all authorized statements, not only the displayed
        page. All timestamps and date filters use UTC.
      </p>
      <PageNavigation label="fee statements" page={page} />
      {page.loading && <p role="status">Loading fee register…</p>}
      {page.error && <p role="alert">Fee register unavailable. {page.error}</p>}
      {!page.loading && !page.error && !page.items.length && (
        <p>No fee statements match these filters.</p>
      )}
      {page.items.map((fee) => (
        <FeeRegisterRow key={fee.id} fee={fee} />
      ))}
    </section>
  );
}
