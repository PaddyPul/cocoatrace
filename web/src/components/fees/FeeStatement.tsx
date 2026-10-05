import { useCallback, useEffect, useState } from 'react';
import { platformFees, type FeeStatement as Statement } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { fmtMoney } from '../shared/helpers';
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function FeeStatement({ contractId }: { contractId: string }) {
  const { user, canDo } = useAuthCtx();
  const admin = canDo('finance.manage');
  const [data, setData] = useState<Statement | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [reference, setReference] = useState(''),
    [receipt, setReceipt] = useState(''),
    [amount, setAmount] = useState(''),
    [currency, setCurrency] = useState(''),
    [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try {
      const value = await platformFees.statement(contractId);
      setData(value);
      setAmount(value.fee.amount_total);
      setCurrency(value.fee.currency);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fee statement');
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
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await load();
      setReference('');
      setReceipt('');
      setReason('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fee action failed';
      await load();
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const f = data?.fee,
    pending = data?.submissions.find((s) => s.status === 'submitted'),
    payer = f?.payer_organization_id === user?.organizationId;
  const due =
    f?.status === 'invoiced' &&
    f.amount_matches !== false &&
    f.payer_matches !== false &&
    !!f.payer_organization_id &&
    f.contract_status === 'settled' &&
    /[1-9]/.test(f.amount_total);
  const canSubmit = payer && (canDo('offer.respond') || canDo('offer.create'));
  return (
    <section
      aria-label="Platform fee statement"
      className="rounded-2xl border border-border bg-surface p-5 space-y-3"
    >
      <h3 className="text-sm font-semibold">Platform fee statement</h3>
      {error && (
        <p role="alert" className="text-red-400 text-xs">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading fee statement…</p>}
      {data && f && (
        <>
          <p className="text-xs">{data.statementNumber}</p>
          <p className="text-sm">
            {fmtMoney(Number(f.amount_total), f.currency)} · {f.fee_payer} pays · {f.rate_bps / 100}
            % · {f.status.split('_').join(' ')}
          </p>
          <p className="text-xs text-text-muted">
            This statement uses its recorded rate and payer. New trades record them at acceptance.
            The fee becomes due after the trade completes. Platform fee collection is separate from
            the buyer’s goods payment.
          </p>
          <p className="text-xs text-text-muted">{data.taxNotice}</p>
          {(f.amount_matches === false ||
            f.payer_matches === false ||
            !f.payer_organization_id) && (
            <p role="status">Fee statement needs platform finance review before collection.</p>
          )}
          {f.due_at && <p className="text-xs">Due since {new Date(f.due_at).toLocaleString()}</p>}
          {f.status === 'estimated' && (
            <p role="status">Estimated fee. No fee payment is due yet.</p>
          )}
          {f.status === 'void' && (
            <p role="status">Fee voided with the unstarted cancellation. No fee payment is due.</p>
          )}
          {f.status === 'paid' && (
            <p role="status">
              {f.receipt_verified
                ? 'Platform receipt verified.'
                : 'Fee recorded as paid; platform finance must review its legacy receipt evidence.'}
            </p>
          )}
          {f.status === 'written_off' && (
            <p role="status">
              Fee written off by platform finance. This does not change goods payment or ownership.
            </p>
          )}
          {f.amount_total === '0.00' && <p role="status">Zero-value fee. No payment required.</p>}
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const value = await platformFees.download(contractId);
                downloadJson(`${value.statementNumber}.json`, value);
              })
            }
          >
            Download fee statement
          </button>
          {pending && <p role="status">Fee payment submitted — awaiting platform verification.</p>}
          {due && !pending && canSubmit && (
            <div>
              <label className="form-label" htmlFor="fee-reference">
                Fee payment reference
              </label>
              <input
                id="fee-reference"
                className="form-input"
                value={reference}
                maxLength={200}
                onChange={(e) => setReference(e.target.value)}
              />
              <p className="text-xs text-text-muted my-2">
                Submit only after paying the stated amount through the external channel agreed with
                the platform. Entering a reference does not verify receipt.
              </p>
              <button
                className="btn btn-sm"
                disabled={busy || [...reference.trim()].length < 3}
                onClick={() => void run(() => platformFees.submit(contractId, reference))}
              >
                Submit fee payment reference
              </button>
            </div>
          )}
          {admin && !payer && due && (
            <div className="space-y-2">
              {pending && (
                <>
                  <p className="text-xs">Payer reference: {pending.reference}</p>
                  <label className="form-label" htmlFor="fee-received">
                    Amount actually received
                  </label>
                  <input
                    id="fee-received"
                    className="form-input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <label className="form-label" htmlFor="fee-currency">
                    Received currency
                  </label>
                  <input
                    id="fee-currency"
                    className="form-input"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                  <label className="form-label" htmlFor="fee-receipt">
                    Platform bank receipt reference
                  </label>
                  <input
                    id="fee-receipt"
                    className="form-input"
                    maxLength={200}
                    value={receipt}
                    onChange={(e) => setReceipt(e.target.value)}
                  />
                  <button
                    className="btn btn-sm"
                    disabled={busy || receipt.trim().length < 3}
                    onClick={() =>
                      void run(() =>
                        platformFees.verify(contractId, pending.id, amount, currency, receipt),
                      )
                    }
                  >
                    Verify platform receipt
                  </button>
                </>
              )}
              <label className="form-label" htmlFor="fee-review-reason">
                Finance decision reason
              </label>
              <textarea
                id="fee-review-reason"
                className="form-input"
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {pending ? (
                <button
                  className="btn btn-sm"
                  disabled={busy || [...reason.trim()].length < 10}
                  onClick={() =>
                    void run(() => platformFees.reject(contractId, pending.id, reason))
                  }
                >
                  Reject fee submission
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  disabled={busy || [...reason.trim()].length < 10}
                  onClick={() => void run(() => platformFees.writeOff(contractId, reason))}
                >
                  Write off unpaid fee
                </button>
              )}
            </div>
          )}
          {data.submissions
            .filter((s) => s.status !== 'submitted')
            .map((s) => (
              <p key={s.id} className="text-xs">
                Submission {s.status}: {s.reference}
                {s.rejection_reason ? ` — ${s.rejection_reason}` : ''}
              </p>
            ))}
        </>
      )}
    </section>
  );
}
