import { useEffect, useState } from 'react';
import { batches } from '../../api';
import { useNavigate } from 'react-router-dom';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';
import { StatusBadge } from '../shared/helpers';
export default function FarmBatches({ farmId }: { farmId: string }) {
  const navigate = useNavigate();
  const page = useCatalogPage(batches.page, { farm: farmId });
  const [version, setVersion] = useState(0);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [totalsError, setTotalsError] = useState('');
  const [totals, setTotals] = useState<{ count: number; recorded_quantity_kg: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    setTotals(null);
    setTotalsLoading(true);
    setTotalsError('');
    batches
      .summary(farmId)
      .then((row) => {
        if (
          !row ||
          !Number.isSafeInteger(row.count) ||
          row.count < 0 ||
          typeof row.recorded_quantity_kg !== 'string' ||
          !Number.isFinite(Number(row.recorded_quantity_kg)) ||
          Number(row.recorded_quantity_kg) < 0
        )
          throw new Error('Invalid farm batch totals');
        if (active) setTotals(row);
      })
      .catch(() => {
        if (active)
          setTotalsError('Batch totals unavailable. Page length is not the full farm total.');
      })
      .finally(() => {
        if (active) setTotalsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [farmId, version]);
  return (
    <section
      aria-label="Farm batch history"
      className="rounded border border-border bg-surface p-5"
    >
      <h3 className="text-sm font-semibold">Recorded batches</h3>
      {totalsLoading ? (
        <p role="status" className="my-2 text-xs">
          Loading farm batch totals…
        </p>
      ) : totals ? (
        <p className="my-2 text-xs">
          {totals.count} recorded batches · {Number(totals.recorded_quantity_kg).toLocaleString()}{' '}
          kg recorded source quantity
        </p>
      ) : (
        <p role="alert" className="my-2 text-xs">
          {totalsError}
        </p>
      )}
      <button
        className="btn btn-sm"
        disabled={page.loading}
        onClick={() => {
          page.refresh();
          setVersion((value) => value + 1);
        }}
      >
        Retry farm batches
      </button>
      {page.loading ? (
        <p role="status">Loading farm batches…</p>
      ) : page.error ? (
        <p role="alert">{page.error}</p>
      ) : (
        <div className="space-y-2">
          {page.items.map((batch) => (
            <button
              key={batch.id}
              className="block w-full rounded border border-border p-3 text-left text-xs"
              onClick={() => navigate(`/batches/${batch.id}`)}
            >
              {batch.id.slice(0, 8)} · {batch.crop} · {batch.quantity_kg} kg{' '}
              <StatusBadge status={batch.organic_claim_status} />
            </button>
          ))}
          {!page.items.length && <p role="status">No batches on this page.</p>}
        </div>
      )}
      <PageNavigation label="farm batches" page={page} />
    </section>
  );
}
