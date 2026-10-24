import { useEffect, useState } from 'react';
import { api } from '../../api/http';
type State = {
  schemaVersion: 1;
  exception: {
    active: boolean;
    hash: string | null;
    reason: string | null;
    recordedAt: string | null;
  };
  acknowledgedAt: string | null;
  yourRole: 'buyer' | 'seller';
  canAcknowledge: boolean;
};
export default function DispatchAcknowledgement({ shipmentId }: { shipmentId: string }) {
  const [opened, setOpened] = useState(false),
    [data, setData] = useState<State | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setOpened(false);
    setData(null);
    setConfirmed(false);
    setError('');
  }, [shipmentId]);
  async function load() {
    setBusy(true);
    setError('');
    try {
      setData(await api<State>('GET', `/shipments/${shipmentId}/dispatch-acknowledgement`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch exception unavailable');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!data?.exception.hash || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      setData(
        await api<State>('POST', `/shipments/${shipmentId}/dispatch-acknowledgement`, {
          exceptionHash: data.exception.hash,
          confirmed: true,
        }),
      );
      setConfirmed(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Acknowledgement failed. Retry after reviewing the current exception.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Exceptional dispatch acknowledgement"
      className="rounded border border-border bg-surface p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold">Exceptional dispatch awareness</h2>
      {error && <p role="alert">{error}</p>}
      {!opened ? (
        <button
          className="btn"
          onClick={() => {
            setOpened(true);
            void load();
          }}
        >
          Review dispatch exception
        </button>
      ) : !data ? (
        <button className="btn" disabled={busy} onClick={() => void load()}>
          {busy ? 'Loading exception…' : 'Retry loading exception'}
        </button>
      ) : !data.exception.active ? (
        <p>No exceptional dispatch is recorded.</p>
      ) : (
        <>
          <p>{data.exception.reason || 'No reason was retained for this legacy exception.'}</p>
          <p className="text-xs">
            Recorded:{' '}
            {data.exception.recordedAt
              ? new Date(data.exception.recordedAt).toLocaleString()
              : 'Time unavailable'}
          </p>
          <p className="text-xs">
            Acknowledgement records awareness. It does not waive rights, confirm payment, authorize
            dispatch or settle the trade.
          </p>
          {data.acknowledgedAt ? (
            <p>Buyer acknowledged {new Date(data.acknowledgedAt).toLocaleString()}</p>
          ) : (
            <p>Buyer has not acknowledged this exception.</p>
          )}
          {data.canAcknowledge && !data.acknowledgedAt && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I reviewed the recorded exceptional dispatch reason.
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy || !confirmed}>
                Acknowledge exceptional dispatch awareness
              </button>
            </form>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              setConfirmed(false);
              void load();
            }}
          >
            Refresh exception
          </button>
        </>
      )}
    </section>
  );
}
