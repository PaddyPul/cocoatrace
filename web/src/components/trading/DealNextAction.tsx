import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contracts, payments } from '../../api';
import PaymentProof from '../payments/PaymentProof';
import type { TradeAction } from './TradeAction';

type Props = {
  action: TradeAction | null;
  contractId: string;
  proofRequired: boolean;
  submittedReference?: string;
  run: (key: string, mutation: () => Promise<unknown>, message: string) => Promise<void>;
};

export default function DealNextAction({
  action,
  contractId,
  proofRequired,
  submittedReference,
  run,
}: Props) {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (key: string, mutation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await run(key, mutation, message);
    } finally {
      setBusy(false);
    }
  };
  if (!action)
    return (
      <section role="status" className="mt-5 rounded-3xl border border-border p-5">
        Next action unavailable. Refresh this deal before continuing.
      </section>
    );
  const go = (path: string, label: string) => (
    <button className="btn btn-primary" onClick={() => navigate(path)}>
      {label}
    </button>
  );
  let control: React.ReactNode = null;
  if (action.requiresAction) {
    switch (action.operation) {
      case 'configure_terms':
        control = go(`/contracts/${contractId}`, 'Configure protection');
        break;
      case 'confirm_terms':
        control = (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              submit(
                'terms',
                () => contracts.confirmPaymentTerms(contractId),
                'Payment terms confirmed',
              )
            }
          >
            Confirm terms
          </button>
        );
        break;
      case 'submit_payment':
        if (action.installmentId) {
          const installmentId = action.installmentId;
          control = (
            <div className="w-full space-y-3">
              {proofRequired && (
                <PaymentProof contractId={contractId} onUploaded={setProof} disabled={busy} />
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="form-input min-w-0 flex-1"
                  aria-label="Bank transaction reference"
                  placeholder="Bank transaction reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={busy || reference.trim().length < 3 || (proofRequired && !proof)}
                  onClick={() =>
                    submit(
                      'submit',
                      () => payments.submitInstallment(installmentId, reference.trim(), proof),
                      'Payment submitted for seller verification',
                    )
                  }
                >
                  Submit payment
                </button>
              </div>
            </div>
          );
        }
        break;
      case 'verify_payment':
        if (action.installmentId) {
          const installmentId = action.installmentId;
          control = (
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  submit(
                    'verify',
                    () => payments.confirmInstallment(installmentId),
                    'Funds marked as received',
                  )
                }
              >
                Confirm funds received
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Why is this payment reference being rejected?');
                  if (reason)
                    submit(
                      'reject',
                      () => payments.rejectInstallment(installmentId, reason),
                      'Reference returned to buyer',
                    );
                }}
              >
                Reject reference
              </button>
            </div>
          );
        }
        break;
      case 'documents':
        control = go(`/contracts/${contractId}`, 'Open trade documents');
        break;
      case 'bank_security':
        control = go(action.actionPath, 'Open bank security');
        break;
      case 'transport':
        control = go(action.actionPath, 'Continue to transport');
        break;
    }
  }
  if (!control && action.actionPath !== `/deal-room/${contractId}`)
    control = go(action.actionPath, action.actionLabel);
  return (
    <section
      data-testid="deal-next-action"
      data-action-id={action.id}
      className="mt-5 rounded-3xl border border-brand-400/25 bg-brand-400/5 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">
            Best next action · {action.requiresAction ? 'Your action' : 'Status'}
          </div>
          <h3 className="mt-1 text-lg font-bold">{action.title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-text-muted">{action.description}</p>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[310px]">
          {action.operation === 'verify_payment' && (
            <p className="mb-3 text-xs">
              Buyer reference:{' '}
              {submittedReference || 'Not available—open the payment schedule to review.'}
            </p>
          )}
          {control}
        </div>
      </div>
    </section>
  );
}
