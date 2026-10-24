import { useUnsavedChanges } from '../shared/UnsavedChanges';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../api/http';
type Timing = {
  shipmentId: string;
  revision: number;
  etaArrival: string | null;
  overdue: boolean;
  canEdit: boolean;
  historyHasMore: boolean;
  history: { revision: number; etaArrival: string; reason: string; recordedAt: string }[];
};
export default function TransportTiming({ shipmentId }: { shipmentId: string }) {
  const formId = useId();
  const [data, setData] = useState<Timing | null>(null),
    [opened, setOpened] = useState(false),
    [eta, setEta] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const baseline = useRef('');
  const dirty = Boolean(reason || (opened && eta !== baseline.current));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useUnsavedChanges(dirty, 'Transport timing');
  useEffect(() => {
    setData(null);
    setOpened(false);
    setEta('');
    setReason('');
    setError('');
  }, [shipmentId]);
  async function load() {
    setBusy(true);
    setError('');
    try {
      const value = await api<Timing>('GET', `/shipments/${shipmentId}/timing`);
      setData(value);
      if (!dirtyRef.current) {
        baseline.current = value.etaArrival ?? '';
        setEta(baseline.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Timing unavailable');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<Timing>('POST', `/shipments/${shipmentId}/timing`, {
        expectedRevision: data.revision,
        etaArrival: eta,
        reason,
      });
      setData(next);
      baseline.current = next.etaArrival ?? '';
      setEta(baseline.current);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Timing update failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Transport timing" className="rounded border border-border p-5 space-y-3">
      <h2 className="font-semibold">Arrival estimate and delay history</h2>
      <p className="text-xs">
        Arrival becomes overdue after the end of the estimated UTC calendar day. This estimate does
        not change payment or milestone responsibilities.
      </p>
      {error && <p role="alert">{error}</p>}
      {!opened ? (
        <button
          className="btn"
          onClick={() => {
            setOpened(true);
            void load();
          }}
        >
          Review transport timing
        </button>
      ) : !data ? (
        <button className="btn" disabled={busy} onClick={() => void load()}>
          {busy ? 'Loading timing…' : 'Retry timing'}
        </button>
      ) : (
        <>
          <p>
            Estimated arrival: {data.etaArrival ?? 'Not recorded'}
            {data.overdue ? ' · Arrival overdue' : ''}
          </p>
          <p>Revision {data.revision}</p>
          <button className="btn" disabled={busy} onClick={() => void load()}>
            Refresh current timing
          </button>
          {data.canEdit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-2"
            >
              <label className="block" htmlFor={`${formId}-eta`}>
                Arrival estimate (UTC date)
              </label>
              <input
                id={`${formId}-eta`}
                className="form-input"
                type="date"
                required
                value={eta}
                disabled={busy}
                onChange={(e) => setEta(e.target.value)}
              />
              <label className="block" htmlFor={`${formId}-reason`}>
                Timing change or delay reason
              </label>
              <textarea
                id={`${formId}-reason`}
                className="form-input"
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
              <button type="submit" className="btn" disabled={busy}>
                Save reviewed timing
              </button>
            </form>
          )}
          <ol>
            {data.history.map((item) => (
              <li key={item.revision}>
                Revision {item.revision}: {item.etaArrival} — {item.reason}
              </li>
            ))}
          </ol>
          {data.historyHasMore && (
            <p>Showing the latest 100 changes. Earlier history remains retained.</p>
          )}
        </>
      )}
    </section>
  );
}
