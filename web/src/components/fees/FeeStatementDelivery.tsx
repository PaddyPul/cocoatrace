import { useCallback, useEffect, useState } from 'react';
import {
  feeStatementDelivery,
  type FeeStatementDeliveryState,
} from '../../api/feeStatementDelivery';
export default function FeeStatementDelivery({ contractId }: { contractId: string }) {
  const [data, setData] = useState<FeeStatementDeliveryState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await feeStatementDelivery.read(contractId));
      setError('');
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Statement delivery unavailable.');
    }
  }, [contractId]);
  useEffect(() => {
    void load();
  }, [load]);
  const send = async () => {
    setBusy(true);
    try {
      setData(await feeStatementDelivery.request(contractId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Statement email request failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Fee statement email"
      className="rounded-xl border border-border p-4 space-y-2"
    >
      <h3 className="text-sm font-semibold">Fee statement email</h3>
      <p className="text-xs">
        Request the issued fee statement for registered payer contacts. Repeated requests are
        deduplicated. Provider or SMTP acceptance does not guarantee inbox delivery; failed delivery
        requires operator recovery.
      </p>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void load()}>
        Refresh statement delivery
      </button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading statement delivery…</p>}
      {data && (
        <>
          <p role="status">
            Queued: {data.queued} · Sending: {data.sending} · Accepted by provider: {data.sent} ·
            Suppressed: {data.suppressed} · Retrying: {data.failed} · Terminal failures:{' '}
            {data.failed_terminal}
          </p>
          {data.missingContact && (
            <p>
              No statement recipients recorded. Ask platform finance to check eligible payer
              contacts.
            </p>
          )}
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void send()}>
            Request fee statement email
          </button>
        </>
      )}
    </section>
  );
}
