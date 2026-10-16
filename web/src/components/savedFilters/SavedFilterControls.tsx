import { useEffect, useRef, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
import {
  createFilter,
  readFilters,
  storageKey,
  writeFilters,
  type FilterScope,
  type FilterValues,
  type SavedFilter,
} from '../../domains/savedFilters/storage';

type Props = { scope: FilterScope; values: FilterValues; onApply: (values: FilterValues) => void };
export default function SavedFilterControls({ scope, values, onApply }: Props) {
  const { user } = useAuthCtx();
  const identity = JSON.stringify([user?.id, user?.organizationId, scope]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [state, setState] = useState<{
    identity: string;
    filters: SavedFilter[];
    notice: string;
    writable: boolean;
  }>({ identity: '', filters: [], notice: '', writable: true });
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setName('');
    setSelected('');
    setError('');
    if (!user?.id || !user.organizationId) {
      setState({ identity, filters: [], notice: 'Sign in to save filters.', writable: false });
      return;
    }
    try {
      setState({
        identity,
        filters: readFilters(localStorage, storageKey(user.id, user.organizationId, scope), scope),
        notice: '',
        writable: true,
      });
    } catch {
      setState({
        identity,
        filters: [],
        notice:
          'Saved filters could not be read. Changes are session-only; existing stored data will be preserved.',
        writable: false,
      });
    }
  }, [identity, scope, user?.id, user?.organizationId]);
  const ready = state.identity === identity;
  const filters = ready ? state.filters : [];
  const update = (next: SavedFilter[]) => {
    if (!ready || currentIdentity.current !== identity || !user?.id || !user.organizationId) return;
    let notice = state.notice;
    let writable = state.writable;
    if (writable)
      try {
        writeFilters(localStorage, storageKey(user.id, user.organizationId, scope), scope, next);
      } catch {
        notice =
          'Saved filters could not be stored. Changes are session-only; existing stored data will be preserved.';
        writable = false;
      }
    setState({ identity, filters: next, notice, writable });
    setError('');
  };
  return (
    <section
      aria-label={`${scope} saved filters`}
      className="my-3 rounded border border-border p-3"
    >
      <p className="text-xs text-text-muted">
        Saved filters stay on this device for your account and organization. They are not shared and
        do not change records or permissions.
      </p>
      {ready && state.notice && <p role="status">{state.notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label className="form-label" htmlFor={`${scope}-filter-name`}>
            Saved filter name
          </label>
          <input
            id={`${scope}-filter-name`}
            className="form-input"
            maxLength={50}
            value={ready ? name : ''}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <button
          className="btn"
          disabled={!ready || !user || !name.trim() || filters.length >= 10}
          onClick={() => {
            try {
              update([...filters, createFilter(scope, name, values, crypto.randomUUID())]);
              setName('');
            } catch {
              setError(
                'Use a name up to 50 characters and supported filter values. URLs, usernames and control characters cannot be saved.',
              );
            }
          }}
        >
          Save current filters
        </button>
        <div>
          <label className="form-label" htmlFor={`${scope}-saved-filter`}>
            Saved filter
          </label>
          <select
            id={`${scope}-saved-filter`}
            className="form-select"
            value={ready ? selected : ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose a saved filter</option>
            {filters.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn"
          disabled={!filters.some((filter) => filter.id === selected)}
          onClick={() => {
            const filter = filters.find((item) => item.id === selected);
            if (filter && currentIdentity.current === identity) onApply({ ...filter.values });
          }}
        >
          Apply saved filter
        </button>
        <button
          className="btn"
          disabled={!filters.some((filter) => filter.id === selected)}
          onClick={() => {
            update(filters.filter((filter) => filter.id !== selected));
            setSelected('');
          }}
        >
          Delete saved filter
        </button>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {filters.length}/10 saved filters. Applying a filter returns to the first page.
      </p>
    </section>
  );
}
