import { useEffect, useState } from 'react';
import { evidence, EvidenceRecordOption } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import SupplyPathChoice from '../supply/SupplyPathChoice';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';

export default function EvidenceRecordPicker({
  kind,
  selected,
  requestedId,
  onChange,
  onReady,
  disabled = false,
  onDashboard,
}: {
  kind: 'farm' | 'batch' | 'contract' | 'shipment';
  selected: EvidenceRecordOption | null;
  requestedId: string;
  onChange: (record: EvidenceRecordOption | null) => void;
  onReady: (ready: boolean) => void;
  disabled?: boolean;
  onDashboard: () => void;
}) {
  const { user } = useAuthCtx();
  const [search, setSearch] = useState('');
  const page = useCatalogPage(evidence.recordOptions, { kind, search });
  const [lookupLoading, setLookupLoading] = useState(Boolean(requestedId));
  const [lookupError, setLookupError] = useState('');
  const [lookupVersion, setLookupVersion] = useState(0);
  useEffect(() => {
    let active = true;
    onChange(null);
    setLookupError('');
    setLookupLoading(Boolean(requestedId));
    if (requestedId)
      evidence
        .recordOptions({ kind, id: requestedId })
        .then((result) => {
          if (!Array.isArray(result?.items)) throw new Error('Invalid record response');
          const record = result.items.find(
            (item) =>
              item.id.toLowerCase() === requestedId.toLowerCase() && typeof item.label === 'string',
          );
          if (active) {
            if (record) onChange(record);
            else
              setLookupError(
                'The requested record is not available in your permitted selection scope. Search for another record.',
              );
          }
        })
        .catch(() => {
          if (active)
            setLookupError(
              'The requested record could not be loaded. Retry the lookup or choose another permitted record.',
            );
        })
        .finally(() => {
          if (active) setLookupLoading(false);
        });
    return () => {
      active = false;
    };
  }, [kind, requestedId, user?.id, lookupVersion, onChange]);
  useEffect(() => {
    onReady(!page.loading && !page.error && !lookupLoading);
  }, [page.loading, page.error, lookupLoading, onReady]);
  const choices =
    selected && !page.items.some((item) => item.id === selected.id)
      ? [selected, ...page.items]
      : page.items;
  return (
    <section aria-label="Evidence record selection" className="space-y-3">
      <label className="block">
        Search permitted records
        <input
          aria-label="Search evidence records"
          maxLength={80}
          className="form-input mt-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
          placeholder="Name, material, reference or exact ID"
        />
      </label>
      {(page.loading || lookupLoading) && <p role="status">Loading permitted records…</p>}
      {page.error && (
        <p role="alert">Records could not be loaded. {page.error} No upload was started.</p>
      )}
      {lookupError && !selected && (
        <div role="alert">
          <p>{lookupError}</p>
          <button
            className="btn btn-sm mt-2"
            disabled={disabled || lookupLoading}
            onClick={() => setLookupVersion((version) => version + 1)}
          >
            Retry requested record
          </button>
        </div>
      )}
      <label className="block">
        Choose record
        <select
          aria-label="Evidence record"
          className="form-select mt-2"
          value={selected?.id || ''}
          disabled={disabled || page.loading || Boolean(page.error) || lookupLoading}
          onChange={(event) =>
            onChange(choices.find((item) => item.id === event.target.value) || null)
          }
        >
          <option value="">Select the record this evidence supports</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-text-muted">
        {page.items.length} records on this page. A selected record stays available when you change
        pages or search.
      </p>
      <button className="btn btn-sm" disabled={disabled || page.loading} onClick={page.refresh}>
        Retry records
      </button>
      <PageNavigation
        label="evidence records"
        page={{ ...page, loading: page.loading || disabled || lookupLoading }}
      />
      {!page.loading &&
        !page.error &&
        !lookupLoading &&
        !page.items.length &&
        !selected &&
        (search || page.hasPrevious ? (
          <p role="status">
            No records match this page and search. Adjust the search or return to the previous page.
          </p>
        ) : (
          <>
            <p role="status">
              No permitted records are available. Create the relevant source or inventory record
              first, or ask your trade colleague to create it.
            </p>
            {kind === 'farm' || kind === 'batch' ? (
              <SupplyPathChoice />
            ) : (
              <button className="btn" onClick={onDashboard}>
                Return to trade dashboard
              </button>
            )}
          </>
        ))}
    </section>
  );
}
