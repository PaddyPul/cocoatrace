import FeeRefunds from './FeeRefunds';
import FeeStatementDelivery from './FeeStatementDelivery';
import FeeEnforcement from './FeeEnforcement';
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
export default function FeeStatement({
  contractId,
  contractStatus,
}: {
  contractId: string;
  contractStatus?: string;
}) {
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
      setData(null);
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
  }, [load, contractStatus]);
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
    (f.policy_version === 'seller-predispatch-v3'
      ? f.contract_status !== 'cancelled'
      : f.contract_status === 'settled') &&
    /[1-9]/.test(f.amount_total);
  const canSubmit = payer && (canDo('offer.respond') || canDo('offer.create'));
  const zeroFee = !!f && !/[1-9]/.test(f.amount_total);
  const collectionLabel = !f
    ? ''
    : f.refund_status === 'confirmed'
      ? 'Platform fee refunded — payer receipt confirmed; original receipt retained'
      : f.refund_status === 'sent'
        ? 'External fee refund recorded — payer receipt pending'
        : f.refund_status === 'requested'
          ? 'Platform fee refund requested — finance review pending'
          : f.amount_matches === false || f.payer_matches === false || !f.payer_organization_id
            ? 'Fee collection needs platform finance review'
            : zeroFee
              ? 'No fee payment required'
              : f.status === 'paid'
                ? f.receipt_verified
                  ? 'Platform fee collected — receipt verified'
                  : 'Recorded paid — receipt verification needs finance review'
                : f.status === 'written_off'
                  ? 'Fee written off — no collection recorded'
                  : f.status === 'void'
                    ? 'Fee void — no payment due'
                    : pending
                      ? 'Fee payment reported — receipt not yet verified'
                      : f.status === 'invoiced'
                        ? 'Platform fee outstanding — collection not verified'
                        : f.status === 'estimated' && f.contract_status !== 'settled'
                          ? f.policy_version === 'seller-predispatch-v3'
                            ? 'Fee terms require seller agreement before payment and dispatch'
                            : 'Fee estimate — payable when the trade completes'
                          : 'Fee collection status needs platform finance review';

  return (
    <section
      aria-label="Platform fee statement"
      className="rounded-2xl border border-border bg-surface p-5 space-y-3"
    >
      <h3 className="text-sm font-semibold">Platform fee statement</h3>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void load()}>
        Refresh fee status
      </button>
      {error && (
        <p role="alert" className="text-red-400 text-xs">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading fee statement…</p>}
      {data && f && (
        <>
          <div
            role="status"
            aria-label="Fee collection status"
            className="rounded-xl border border-border p-3 space-y-2"
          >
            <strong className="text-sm">{collectionLabel}</strong>
            <p className="text-xs">
              Fee payer:{' '}
              {f.fee_payer === 'seller'
                ? f.seller_name
                : f.fee_payer === 'buyer'
                  ? f.buyer_name
                  : f.fee_payer}{' '}
              ({f.fee_payer}).
            </p>
            <p className="text-xs">
              {f.policy_version === 'seller-predispatch-v3'
                ? 'For this new trade, the seller accepts the recorded fee terms and pays before dispatch. Verified platform receipt, an active finance credit exception or an audited finance write-off is required.'
                : 'Due at trade completion, after goods payment and buyer delivery acceptance.'}{' '}
              A completed trade or a fee statement does not mean the fee was collected. No automatic
              deduction or debit is made.
            </p>
            {f.status === 'invoiced' && !zeroFee && (
              <p className="text-xs">
                {payer
                  ? 'Your organization must pay this fee separately.'
                  : 'The recorded payer must pay this fee separately; the buyer goods payment does not collect it.'}{' '}
                {pending
                  ? 'Platform finance must verify the external receipt before marking it paid.'
                  : 'The payer should obtain confirmed payment instructions from platform finance, pay externally, then submit the fee payment reference.'}
              </p>
            )}
          </div>

          {f.policy_version === 'seller-predispatch-v3' && (
            <FeeEnforcement contractId={contractId} onChanged={() => void load()} />
          )}
          <p className="text-xs">{data.statementNumber}</p>
          <p className="text-sm">
            {fmtMoney(Number(f.amount_total), f.currency, f.currency_minor_units)} · {f.fee_payer}{' '}
            pays · {f.rate_bps / 100}% · {f.status.split('_').join(' ')}
          </p>
          <p className="text-xs text-text-muted">
            This statement uses its recorded rate and payer. New trades record them at acceptance.
            {f.policy_version === 'seller-predispatch-v3'
              ? 'This trade uses pre-dispatch fee collection after explicit seller agreement.'
              : 'The fee becomes due after the trade completes.'}{' '}
            Platform fee collection is separate from the buyer’s goods payment.
          </p>
          <p className="text-xs text-text-muted">{data.taxNotice}</p>
          {(f.amount_matches === false ||
            f.payer_matches === false ||
            !f.payer_organization_id) && (
            <p role="status">Fee statement needs platform finance review before collection.</p>
          )}
          {f.due_at && <p className="text-xs">Due since {new Date(f.due_at).toLocaleString()}</p>}
          {f.status === 'estimated' && (
            <p role="status">
              {f.policy_version === 'seller-predispatch-v3'
                ? 'Accept the recorded fee terms to make payment due before dispatch.'
                : 'Estimated fee. No fee payment is due yet.'}
            </p>
          )}
          {f.status === 'void' && (
            <p role="status">Fee voided with the unstarted cancellation. No fee payment is due.</p>
          )}
          {f.status === 'paid' &&
            !['requested', 'sent', 'confirmed'].includes(f.refund_status || '') && (
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
          {data.refundSupported && (
            <FeeRefunds contractId={contractId} onChanged={() => void load()} />
          )}
          {data.statementDeliverySupported && (payer || admin) && (
            <FeeStatementDelivery contractId={contractId} />
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
