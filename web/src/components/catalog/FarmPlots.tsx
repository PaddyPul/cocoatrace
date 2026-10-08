import { useState, useEffect } from 'react';
import { farms } from '../../api';
import { useCatalogPage } from './useCatalogPage';
import { useCollectionCount } from './useCollectionCount';
import PageNavigation from './PageNavigation';
function coordinates(lat: unknown, lng: unknown) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
    return '';
  return ` · ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}
export default function FarmPlots({ farmId, onCreate }: { farmId: string; onCreate?: () => void }) {
  const [search, setSearch] = useState(''),
    [version, setVersion] = useState(0);
  const page = useCatalogPage(
    (parameters) =>
      farms.plotsPage(farmId, {
        search: parameters.search,
        limit: parameters.limit,
        ...(parameters.cursor ? { cursor: parameters.cursor } : {}),
      }),
    { search, limit: '50', farmScope: farmId },
  );
  const total = useCollectionCount(() => farms.plotsSummary(farmId), farmId, version);
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
    <section aria-label="Farm plot records" className="bg-surface border border-border rounded p-5">
      <h3>
        Plots — {total.count === null ? 'total unavailable' : `${total.count} registered records`}
      </h3>
      {onCreate && (
        <button className="btn" onClick={onCreate}>
          Add source plot
        </button>
      )}
      <input
        aria-label="Search farm plots"
        maxLength={80}
        className="form-input my-3"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {total.error && <p role="alert">Plot {total.error}</p>}
      {page.loading ? (
        <p role="status">Loading plots…</p>
      ) : page.error ? (
        <p role="alert">Plots unavailable. {page.error}</p>
      ) : (
        <div className="space-y-2">
          {page.items.map((plot) => (
            <div
              key={plot.id}
              className="bg-surface-darker border border-border rounded p-3 text-xs"
            >
              <strong>{plot.plot_code}</strong> · {plot.area_hectares} ha
              <p>
                {plot.crops.join(', ') || 'Crop not recorded'}
                {coordinates(plot.gps_lat, plot.gps_lng)}
              </p>
            </div>
          ))}
          {!page.items.length && <p>No plots match this farm and search.</p>}
        </div>
      )}
      <button className="btn" disabled={page.loading} onClick={refresh}>
        Retry farm plots
      </button>
      <PageNavigation label="farm plots" page={page} />
    </section>
  );
}
