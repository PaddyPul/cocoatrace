import { useCallback, useEffect, useId, useState } from 'react';
import { feeEnforcement, type FeeEnforcementState } from '../../api/feeEnforcement';
import { useAuthCtx } from '../auth/AuthProvider';

export default function FeeEnforcement({
  contractId,
  onChanged,
}: {
  contractId: string;
  onChanged?: () => void;
}) {
  const { user, canDo } = useAuthCtx();
  const id = useId();
  const [data, setData] = useState<FeeEnforcementState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await feeEnforcement.read(contractId));
      setError('');
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Fee terms unavailable.');
    }
    setReviewed(false);
    setAccepted(false);
  }, [contractId]);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await load();
      onChanged?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fee action failed.';
      await load();
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const payer =
    !!data?.payer_organization_id && data.payer_organization_id === user?.organizationId;
  const finance = canDo('finance.manage');
  const date = until ? new Date(until) : null;
  const validUntil = !!date && Number.isFinite(date.getTime()) && date.getTime() > Date.now();
  return (
    <section
      aria-label="Platform fee collection terms"
      className="rounded-2xl border border-border bg-surface p-5 space-y-3"
    >
      <h3 className="text-sm font-semibold">Platform fee collection terms</h3>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void load()}>
        Refresh collection terms
      </button>
      {error && (
        <p role="alert" className="text-red-400 text-xs">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading collection terms…</p>}
      {data && !data.enforced && (
        <p>
          Existing trade: pre-dispatch fee enforcement does not apply. Follow the recorded fee
          statement; outstanding collection does not reverse goods completion.
        </p>
      )}
      {data?.enforced && (
        <>
          <p className="font-semibold">
            {data.currency} {data.amount_total} · seller platform fee · {data.policy_version}
          </p>
          <p className="text-sm whitespace-pre-wrap">{data.terms}</p>
          <p className="text-xs">
            The seller must accept these terms and platform finance must verify the external fee
            receipt before dispatch, unless a current credit exception or an audited finance
            write-off permits dispatch. Submitting a payment reference is not verified collection.
            No automatic deduction or debit is made.
          </p>
          <p role="status">
            {data.status === 'written_off'
              ? 'Platform finance wrote off this fee. Payment is waived; no receipt is recorded.'
              : Number(data.amount_total) === 0
                ? 'Zero fee: no payment is required after seller acceptance of the terms.'
                : data.receipt_verified
                  ? 'Platform fee receipt verified.'
                  : data.credit_active
                    ? 'Temporary credit exception active; the fee remains payable.'
                    : 'Platform fee receipt not verified. Dispatch remains subject to the fee gate.'}
          </p>
          {data.terms_accepted_at ? (
            <p>Fee terms accepted {new Date(data.terms_accepted_at).toLocaleString()}.</p>
          ) : payer ? (
            <div className="space-y-2">
              <label htmlFor={`${id}-accept`} className="flex items-start gap-2">
                <input
                  id={`${id}-accept`}
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I accept the displayed platform fee amount, payer, collection and
                cancellation/refund terms.
              </label>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || !accepted}
                onClick={() =>
                  void run(() =>
                    feeEnforcement.accept(
                      contractId,
                      data.policy_version!,
                      data.expectedFingerprint!,
                    ),
                  )
                }
              >
                Accept platform fee terms
              </button>
            </div>
          ) : (
            <p>The recorded seller payer must accept these terms.</p>
          )}
          {data.credit_until && (
            <p className="text-xs">
              Recorded credit expiry: {new Date(data.credit_until).toLocaleString()}.{' '}
              {data.credit_active ? 'Active' : 'Expired or revoked'}.
            </p>
          )}
          {finance && (
            <div
              role="group"
              aria-label="Platform fee credit exception"
              className="border-t border-border pt-3 space-y-2"
            >
              <p className="text-xs">
                Finance approval permits dispatch on credit; it does not mark the fee paid or
                release any other dispatch gate. Fresh passkey verification may be required.
              </p>
              <label htmlFor={`${id}-reason`}>Credit decision reason</label>
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
              <label htmlFor={`${id}-until`}>Credit exception expiry</label>
              <input
                id={`${id}-until`}
                type="datetime-local"
                className="form-input"
                value={until}
                onChange={(e) => {
                  setUntil(e.target.value);
                  setReviewed(false);
                }}
              />
              <label htmlFor={`${id}-reviewed`} className="flex items-start gap-2">
                <input
                  id={`${id}-reviewed`}
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed the unpaid fee and this credit decision.
              </label>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || !reviewed || reason.trim().length < 10 || !validUntil}
                onClick={() =>
                  void run(() =>
                    feeEnforcement.credit(
                      contractId,
                      reason,
                      data.credit_revision!,
                      date!.toISOString(),
                    ),
                  )
                }
              >
                Grant temporary fee credit
              </button>
              {data.credit_active && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy || !reviewed || reason.trim().length < 10}
                  onClick={() =>
                    void run(() =>
                      feeEnforcement.credit(contractId, reason, data.credit_revision!, null),
                    )
                  }
                >
                  Revoke fee credit
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
