import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { platformFees } from '../../api';
import { useCatalogPage } from '../catalog/useCatalogPage';
import { FeeRegisterRow } from './FeeRegister';

export default function FinanceReviewQueue() {
  const page = useCatalogPage(platformFees.page, { review: 'pending', limit: '5' });
  useEffect(() => {
    const timer = window.setInterval(page.refresh, 15000);
    window.addEventListener('focus', page.refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', page.refresh);
    };
  }, [page.refresh]);
  return (
    <section
      aria-label="Platform finance actions"
      className="mb-5 space-y-3 rounded-3xl border border-amber-300/30 p-5"
    >
      <h2 className="text-xl font-semibold">Pending platform fee receipt reviews</h2>
      <p className="text-sm">
        Independently check receipt before verifying a submitted payment reference. Verification
        still requires a fresh passkey.
      </p>
      {page.loading && <p role="status">Checking pending fee reviews…</p>}
      {page.error && <p role="alert">Pending fee reviews unavailable. {page.error}</p>}
      {!page.loading && !page.error && !page.items.length && <p>No pending fee receipt reviews.</p>}
      {page.items.map((fee) => (
        <FeeRegisterRow key={fee.id} fee={fee} />
      ))}
      {page.hasNext && <p>More pending reviews are available in the fee register.</p>}
      <button className="btn mr-3" disabled={page.loading} onClick={page.refresh}>
        Refresh pending fee reviews
      </button>
      <Link className="btn" to="/platform-fees">
        Open platform fee register
      </Link>
    </section>
  );
}
