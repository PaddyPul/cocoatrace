import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { feeRefunds, type FeeRefundState } from '../../api/feeRefunds';

export default function FeeRefunds({
  contractId,
  onChanged,
}: {
  contractId: string;
  onChanged?: () => void;
}) {
  const id = useId();
  const [data, setData] = useState<FeeRefundState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    setReviewed(false);
    try {
      setData(await feeRefunds.read(contractId));
      setError('');
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Fee refund history unavailable.');
    }
  }, [contractId]);
  useEffect(() => {
    void load();
    const refresh = () => {
      void load();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);
  const run = async (work: () => Promise<FeeRefundState>) => {
    setBusy(true);
    setError('');
    try {
      setData(await work());
      setReviewed(false);
      setReason('');
      setReference('');
      requestKey.current = crypto.randomUUID();
      onChanged?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fee refund action failed.';
      await load();
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const refund = data?.refund;
  const enabled = !!data && reviewed && reason.trim().length >= 10 && !busy;
  const actionAvailable =
    data && (data.canRequest || data.canSend || data.canConfirm || data.canReject);
  return (
    <section
      aria-label="Platform fee refund"
      className="rounded-xl border border-border p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold">Platform fee refund</h3>
      <p className="text-xs">
        Full platform fee only. This workflow records an external refund and payer receipt; it does
        not send money, refund goods payments or cancel the trade. Finance must verify eligibility
        and fresh passkey assurance before recording an external refund.
      </p>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void load()}>
        Refresh fee refund
      </button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading fee refund…</p>}
      {data && (
        <>
          <p role="status">
            {refund
              ? `Fee refund ${refund.status} · ${refund.currency} ${refund.amount}`
              : 'No platform fee refund recorded.'}
          </p>
          {data.blockedReason && <p>{data.blockedReason}</p>}
          {refund && <p className="whitespace-pre-wrap">Request reason: {refund.reason}</p>}
          {refund?.externalReference && (
            <p className="break-all">External refund reference: {refund.externalReference}</p>
          )}
          {refund?.status === 'sent' && (
            <p>Finance recorded an external refund. Payer receipt is not yet confirmed.</p>
          )}
          {refund?.status === 'confirmed' && (
            <p>The payer confirmed receipt of the full platform fee refund.</p>
          )}
          {actionAvailable && (
            <div role="group" aria-label="Fee refund action review" className="space-y-2">
              <label htmlFor={`${id}-reason`}>Fee refund explanation</label>
              <textarea
                id={`${id}-reason`}
                className="form-input"
                maxLength={2000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReviewed(false);
                }}
              />
              {data.canSend && (
                <>
                  <p>
                    Record only the full external refund: {refund?.currency} {refund?.amount}. A
                    payment instruction alone is not a sent refund.
                  </p>
                  <label htmlFor={`${id}-reference`}>External refund reference</label>
                  <input
                    id={`${id}-reference`}
                    className="form-input"
                    maxLength={200}
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      setReviewed(false);
                    }}
                  />
                </>
              )}
              <label htmlFor={`${id}-reviewed`} className="flex gap-2">
                <input
                  id={`${id}-reviewed`}
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed the current platform fee refund and this action.
              </label>
              <p className="text-xs">
                An explanation of at least 10 characters and confirmation are required. Refreshing
                clears confirmation and preserves your draft.
              </p>
              {data.canRequest && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!enabled}
                  onClick={() =>
                    void run(() =>
                      feeRefunds.request(
                        contractId,
                        reason,
                        requestKey.current,
                        data.expectedFingerprint,
                      ),
                    )
                  }
                >
                  Request full fee refund
                </button>
              )}
              {data.canSend && refund && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!enabled || reference.trim().length < 3}
                  onClick={() =>
                    void run(() =>
                      feeRefunds.send(contractId, {
                        refundId: refund.id,
                        expectedRevision: refund.revision,
                        amount: refund.amount,
                        currency: refund.currency,
                        reference,
                        reason,
                      }),
                    )
                  }
                >
                  Record external fee refund
                </button>
              )}
              {data.canConfirm && refund && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!enabled}
                  onClick={() =>
                    void run(() =>
                      feeRefunds.decide(contractId, 'confirm', refund.id, refund.revision, reason),
                    )
                  }
                >
                  Confirm full fee refund received
                </button>
              )}
              {data.canReject && refund && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!enabled}
                  onClick={() =>
                    void run(() =>
                      feeRefunds.decide(contractId, 'reject', refund.id, refund.revision, reason),
                    )
                  }
                >
                  Reject fee refund request
                </button>
              )}
            </div>
          )}
          <h4 className="text-sm font-semibold">Fee refund history</h4>
          {data.history.length ? (
            <ol className="space-y-2">
              {data.history.map((event) => (
                <li key={event.id} className="text-xs whitespace-pre-wrap">
                  {event.action} · {new Date(event.created_at).toLocaleString()} — {event.reason}
                </li>
              ))}
            </ol>
          ) : (
            <p>No fee refund decisions recorded.</p>
          )}
        </>
      )}
    </section>
  );
}
