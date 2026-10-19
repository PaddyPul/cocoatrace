import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlatformRoleNotice from '../components/shared/PlatformRoleNotice';
import { useUnsavedChanges } from '../components/shared/UnsavedChanges';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PaymentProof from '../components/payments/PaymentProof';
import PaymentOperations, { hasActivePaymentIssue } from '../components/payments/PaymentOperations';
import { payments, evidence, type PaymentOperationsData } from '../api';
import { StatusBadge, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Building2, CheckCircle2, FileText, ShieldCheck, User } from 'lucide-react';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import { SkeletonDetail } from '../components/shared/Skeleton';

const pretty = (value: string) =>
  String(value || '—')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [operations, setOperations] = useState<PaymentOperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readAttempt, setReadAttempt] = useState(0);
  const [reference, setReference] = useState('');
  const [proofs, setProofs] = useState<Record<string, string | undefined>>({});
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState('');
  const [receiptReview, setReceiptReview] = useState<{ id: string; message: string } | null>(null);
  const [receiptError, setReceiptError] = useState('');

  useUnsavedChanges(
    Boolean(reference || provider || Object.values(proofs).some(Boolean)),
    'Goods payment',
  );
  const refresh = useCallback(async () => {
    if (!id) return;
    const [payment, operationData] = await Promise.all([payments.get(id), payments.operations(id)]);
    setData(payment);
    setError('');
    setOperations(operationData);
  }, [id]);
  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh, readAttempt]);
  const act = async (name: string, action: () => Promise<unknown>, message: string) => {
    setBusy(name);
    try {
      await action();
      if (name.startsWith('submit-')) {
        setReference('');
        setProofs((current) => ({ ...current, [name.slice(7)]: undefined }));
      }
      if (name === 'security') {
        setReference('');
        setProvider('');
      }
      await refresh();
      toast('success', message);
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy('');
    }
  };

  if (loading)
    return (
      <Layout currentPage="payments">
        <SkeletonDetail />
      </Layout>
    );
  if (error || !data)
    return (
      <Layout currentPage="payments">
        <section role="alert">
          <Error message={error || 'Payment unavailable'} />
          <button className="btn mt-3" onClick={() => setReadAttempt((value) => value + 1)}>
            Retry payment
          </button>
        </section>
      </Layout>
    );
  const p = data;
  const isBuyer = p.buyer_organization_id === user?.organizationId;
  const isSeller = p.seller_organization_id === user?.organizationId;
  const installments = p.installments || [];
  const held = hasActivePaymentIssue(operations);

  return (
    <Layout
      currentPage="payments"
      actions={
        <button className="btn btn-sm" onClick={() => navigate('/payments')}>
          <ArrowLeft size={14} /> Back
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold">Protected Payment</h1>
                <p className="font-mono text-xs text-text-muted mt-0.5">{p.id}</p>
              </div>
              <StatusBadge domain="payment" status={p.status} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Trade value"
                value={fmtMoney(p.amount_total, p.currency, p.currency_minor_units)}
                highlight
              />
              <Field
                label="Confirmed received"
                value={fmtMoney(p.amount_confirmed || 0, p.currency, p.currency_minor_units)}
              />
              <Field label="Seller" value={p.seller_name} icon={<Building2 size={14} />} />
              <Field label="Buyer" value={p.buyer_name} icon={<User size={14} />} />
              <Field label="Protection plan" value={pretty(p.payment_plan)} />
              <Field
                label="Terms"
                value={<StatusBadge domain="terms" status={p.payment_terms_status} />}
              />
              <Field label="Document release" value={pretty(p.release_status)} />
              <Field
                label="Platform fee"
                value={fmtMoney(p.platform_fee_amount || 0, p.currency, p.currency_minor_units)}
              />
            </div>
          </div>

          <PlatformRoleNotice />
          <div className="bg-surface border border-border rounded p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-brand-400" /> How protection works
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              The buyer records an external bank transaction reference. The seller independently
              verifies receipt before an installment counts as paid. BetterTrade does not hold funds
              or provide escrow. A proof upload or reference is not bank verification. The seller
              must check receipts and any bank security outside the app. Controlled document release
              governs access to uploaded files, not legal title or original documents held by a
              bank. Dispatch and controlled document release follow the agreed plan.
            </p>
          </div>

          <div className="bg-surface border border-border rounded p-5">
            <h3 className="text-sm font-semibold mb-4">Payment schedule</h3>
            <div className="space-y-3">
              {installments.map((item: any) => (
                <div key={item.id} className="border border-border rounded p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{pretty(item.installment_type)}</div>
                      <div className="text-[11px] text-text-muted">
                        Due: {pretty(item.due_trigger)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        {fmtMoney(item.amount_due, p.currency, p.currency_minor_units)}
                      </div>
                      <StatusBadge domain="payment" status={item.status} />
                    </div>
                  </div>
                  {item.payment_reference_external && (
                    <div className="mt-2 text-[11px] font-mono">
                      Reference: {item.payment_reference_external}
                    </div>
                  )}
                  {item.payment_evidence_id && (
                    <button
                      className="btn text-xs mt-2"
                      onClick={() =>
                        act(
                          'download-proof',
                          () =>
                            evidence.download(
                              item.payment_evidence_id,
                              item.payment_evidence_file_name || 'payment-proof',
                            ),
                          'Proof downloaded',
                        )
                      }
                    >
                      Download payment proof
                    </button>
                  )}
                  {!held && isBuyer && item.status === 'due' && p.payment_evidence_required && (
                    <PaymentProof
                      contractId={p.contract_id}
                      disabled={Boolean(busy)}
                      onUploaded={(proof) =>
                        setProofs((current) => ({ ...current, [item.id]: proof }))
                      }
                    />
                  )}
                  {!held && isBuyer && item.status === 'due' && (
                    <div className="mt-3 flex gap-2">
                      <input
                        className="form-input"
                        placeholder="Bank transaction reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                      <button
                        className="btn btn-primary text-xs shrink-0"
                        disabled={
                          reference.trim().length < 3 ||
                          Boolean(busy) ||
                          (p.payment_evidence_required && !proofs[item.id])
                        }
                        onClick={() =>
                          act(
                            `submit-${item.id}`,
                            () => payments.submitInstallment(item.id, reference, proofs[item.id]),
                            'Payment submitted for seller verification',
                          )
                        }
                      >
                        {busy === `submit-${item.id}` ? 'Submitting…' : 'Submit payment'}
                      </button>
                    </div>
                  )}
                  {!held && isSeller && item.status === 'payment_submitted' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn btn-primary text-xs"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          setReceiptReview({
                            id: item.id,
                            message: `Contract ${p.contract_id}; instalment ${item.id}; amount ${item.amount_due} ${p.currency}; buyer reference ${item.payment_reference_external || 'not recorded'}. Confirm only after independently checking actual receipt in your bank account. This records verified goods-payment receipt and may advance trade clearance; a buyer reference alone is not proof.`,
                          })
                        }
                      >
                        Confirm funds received
                      </button>
                      <button
                        className="btn text-xs"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          const reason = window.prompt(
                            'Why are you rejecting this payment reference?',
                          );
                          if (reason)
                            act(
                              `reject-${item.id}`,
                              () => payments.rejectInstallment(item.id, reason),
                              'Payment returned to buyer',
                            );
                        }}
                      >
                        Reject reference
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {operations && (
            <PaymentOperations
              payment={p}
              operations={operations}
              organizationId={user?.organizationId || ''}
              isBuyer={isBuyer}
              isSeller={isSeller}
              busy={Boolean(busy)}
              onAction={act}
            />
          )}
        </div>

        <div>
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Workflow actions</h4>
            <div className="space-y-2">
              {!held &&
                isBuyer &&
                p.payment_plan === 'bank_secured' &&
                ['awaiting_submission', 'rejected'].includes(p.security_status) && (
                  <>
                    <input
                      className="form-input"
                      placeholder="Bank / provider"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Guarantee or LC reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                    <button
                      className="btn btn-primary w-full justify-center text-xs"
                      disabled={!provider || !reference || Boolean(busy)}
                      onClick={() =>
                        act(
                          'security',
                          () => payments.submitSecurity(p.id, provider, reference),
                          'Bank security submitted',
                        )
                      }
                    >
                      Submit bank security
                    </button>
                  </>
                )}
              {!held && isSeller && p.security_status === 'submitted' && (
                <button
                  className="btn btn-primary w-full justify-center text-xs"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    act(
                      'confirm-security',
                      () => payments.confirmSecurity(p.id),
                      'External bank security accepted by seller',
                    )
                  }
                >
                  Accept externally checked bank security
                </button>
              )}
              {!held &&
                isSeller &&
                ['documentary_collection', 'deposit_balance', 'bank_secured'].includes(
                  p.payment_plan,
                ) &&
                !p.documents_presented_at && (
                  <button
                    className="btn btn-primary w-full justify-center text-xs"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      act(
                        'documents',
                        () => payments.submitDocuments(p.id),
                        'Documents presented for payment',
                      )
                    }
                  >
                    <FileText size={14} /> Present document set
                  </button>
                )}
              {p.status === 'settled' && (
                <div className="text-center py-3">
                  <CheckCircle2 className="text-green-400 mx-auto mb-1" size={20} />
                  <div className="text-xs font-semibold text-green-400">Payment fully verified</div>
                </div>
              )}
              <button
                className="btn w-full justify-center text-xs"
                onClick={() => navigate(`/contracts/${p.contract_id}`)}
              >
                <FileText size={14} /> View contract
              </button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={receiptReview !== null}
        title="Review funds receipt"
        message={receiptReview?.message || ''}
        confirmLabel="Confirm verified receipt"
        loading={Boolean(busy)}
        error={receiptError}
        onCancel={() => {
          if (!busy) {
            setReceiptReview(null);
            setReceiptError('');
          }
        }}
        onConfirm={() => {
          if (!receiptReview || busy) return;
          setReceiptError('');
          void act(
            `confirm-${receiptReview.id}`,
            async () => {
              try {
                const result = await payments.confirmInstallment(receiptReview.id);
                setReceiptReview(null);
                return result;
              } catch (error) {
                setReceiptError(
                  error instanceof globalThis.Error ? error.message : 'Receipt verification failed',
                );
                throw error;
              }
            },
            'Receipt verified',
          );
        }}
      />
    </Layout>
  );
}

function Field({
  label,
  value,
  highlight = false,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div>
      <div
        className={`${highlight ? 'text-xl font-bold text-brand-400 font-mono' : 'text-sm font-medium'} flex items-center gap-1`}
      >
        {icon}
        {value || '—'}
      </div>
    </div>
  );
}
function Error({ message }: { message: string }) {
  return (
    <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
      {message}
    </div>
  );
}
