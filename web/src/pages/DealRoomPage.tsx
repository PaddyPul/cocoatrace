import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Circle, Download, FileText, Landmark, LockKeyhole, PackageCheck, Settings, ShieldCheck, Ship, WalletCards } from 'lucide-react';
import PaymentProof from '../components/payments/PaymentProof';
import ContractCancellation from '../components/trading/ContractCancellation';
import DeliveryAcceptance from '../components/delivery/DeliveryAcceptance';
import Layout from '../components/layout/Layout';
import { contracts, payments } from '../api';
import { fmtMoney, StatusBadge } from '../components/shared/helpers';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';

const TRANSPORT_ORDER = ['planning', 'booked', 'requested', 'accepted', 'cargo_ready', 'picked_up', 'warehouse_received', 'handed_over', 'port_received', 'loaded', 'departed', 'arrived', 'customs_cleared', 'delivered'];
const PLAN_LABELS: Record<string, string> = {
  pay_before_dispatch: 'Full payment before dispatch',
  deposit_balance: 'Deposit before dispatch; balance against documents',
  bank_secured: 'Seller-accepted external bank security before dispatch',
  documentary_collection: 'Documents against payment',
  pay_after_delivery: 'Approved credit after delivery',
};

export default function DealRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthCtx();
  const { toast } = useToast();
  const [deal, setDeal] = useState<any>(null);
  const [error, setError] = useState('');
  const [proofs, setProofs] = useState<Record<string, string | undefined>>({});
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => { if (id) setDeal(await contracts.get(id)); }, [id]);
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [refresh]);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try { await action(); await refresh(); setReference(''); toast('success', message); }
    catch (err: any) { toast('error', err.message); } finally { setBusy(''); }
  };

  if (!deal && !error) return <Layout currentPage="deal-room"><SkeletonDetail /></Layout>;
  if (error || !deal) return <Layout currentPage="deal-room"><div className="rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-300">{error || 'Deal not found'}</div></Layout>;

  if (deal.status === 'cancelled') return <Layout currentPage="deal-room"><h1 className="text-xl font-semibold mb-4">Trade cancelled</h1><ContractCancellation contractId={deal.id} organizationId={user?.organizationId || ''} onChanged={refresh} /><button className="btn mt-4" onClick={() => navigate(`/contracts/${deal.id}`)}>View archived contract and documents</button></Layout>;

  const isBuyer = deal.buyer_organization_id === user?.organizationId;
  const isSeller = deal.seller_organization_id === user?.organizationId;
  const total = Number(deal.quantity_kg) * Number(deal.price_per_kg);
  const termsReady = deal.payment_terms_status === 'agreed';
  const securityReady = deal.payment_plan !== 'bank_secured' || deal.security_status === 'verified';
  const moneyReady = Number(deal.amount_confirmed || 0) + 0.005 >= Number(deal.dispatch_required_amount || 0);
  const dispatchReady = termsReady && securityReady && moneyReady;
  const currentTransportIndex = TRANSPORT_ORDER.indexOf(deal.current_milestone || 'planning');
  const dispatched = currentTransportIndex >= TRANSPORT_ORDER.indexOf('picked_up');
  const delivered = deal.current_milestone === 'delivered';
  const settled = deal.status === 'settled';
  const dueInstallment = (deal.installments || []).find((item: any) => item.status === 'due');
  const submittedInstallment = (deal.installments || []).find((item: any) => item.status === 'payment_submitted');
  const controlledDocsReleased = deal.release_status === 'authorized';

  const stages = [
    { label: 'Agreement', done: true },
    { label: 'Payment protection', done: termsReady },
    { label: 'Dispatch', done: dispatched },
    { label: 'Delivery', done: delivered },
    { label: 'Settlement', done: settled },
  ];
  const currentStage = Math.max(0, stages.findIndex((stage) => !stage.done));

  let nextTitle: string;
  let nextCopy: string;
  let nextAction: React.ReactNode = null;
  if (!settled && delivered && deal.delivery_discrepancy_status) {
    nextTitle = 'Resolve the delivery discrepancy'; nextCopy = 'Trade completion remains paused. Review the evidence and resolution below.';
  } else if (!settled && delivered && !deal.delivery_accepted_at && deal.payment_status === 'settled') {
    nextTitle = isBuyer ? 'Inspect and accept delivered goods' : 'Awaiting buyer delivery acceptance'; nextCopy = 'Reported delivery is separate from acceptance of the contracted quantity and condition. Review delivery below.';
  } else if (deal.payment_terms_status === 'draft' && isSeller) {
    nextTitle = 'Set the payment protection plan'; nextCopy = 'Choose when payment or bank security must be verified before dispatch.';
    nextAction = <button className="btn btn-primary" onClick={() => navigate(`/contracts/${deal.id}`)}><ShieldCheck size={14} />Configure protection</button>;
  } else if (deal.payment_terms_status === 'draft' && isBuyer) {
    nextTitle = 'Offer accepted—supplier preparing payment terms'; nextCopy = `${deal.seller_name} must select and propose the payment protection plan before you can review it.`;
  } else if (deal.payment_terms_status === 'proposed' && isBuyer) {
    nextTitle = 'Confirm the payment terms'; nextCopy = `${deal.seller_name} proposed “${PLAN_LABELS[deal.payment_plan] || deal.payment_plan}”. ${deal.payment_evidence_required ? 'Payment proof is required for every installment.' : 'Payment proof is optional.'}`;
    nextAction = <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run('terms', () => contracts.confirmPaymentTerms(deal.id), 'Payment terms confirmed')}><Check size={14} />{busy === 'terms' ? 'Confirming…' : 'Confirm terms'}</button>;
  } else if (deal.payment_terms_status === 'proposed' && isSeller) {
    nextTitle = 'Payment terms sent—awaiting buyer confirmation'; nextCopy = `${deal.buyer_name} can now review and confirm the proposed plan.`;
  } else if (dueInstallment && isBuyer) {
    nextTitle = 'Submit the payment reference'; nextCopy = `${fmtMoney(dueInstallment.amount_due, deal.currency)} is now due. Record the reference from your regulated payment provider.`;
    nextAction = <div className="w-full space-y-3">{deal.payment_evidence_required && <PaymentProof key={dueInstallment.id} contractId={deal.id} onUploaded={proof => setProofs(current => ({ ...current, [dueInstallment.id]: proof }))} disabled={Boolean(busy)} />}<div className="flex w-full flex-col gap-2 sm:flex-row"><input className="form-input min-w-0 flex-1" placeholder="Bank transaction reference" value={reference} onChange={(event) => setReference(event.target.value)} /><button className="btn btn-primary shrink-0" disabled={reference.trim().length < 3 || Boolean(busy) || (deal.payment_evidence_required && !proofs[dueInstallment.id])} onClick={() => run('submit', () => payments.submitInstallment(dueInstallment.id, reference.trim(), proofs[dueInstallment.id]), 'Payment submitted for seller verification')}><WalletCards size={14} />{busy === 'submit' ? 'Submitting…' : 'Submit payment'}</button></div></div>;
  } else if (submittedInstallment && isSeller) {
    nextTitle = 'Verify receipt of funds'; nextCopy = `The buyer submitted reference ${submittedInstallment.payment_reference_external}. Confirm only after checking the receiving account.`;
    nextAction = <div className="flex gap-2"><button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run('verify', () => payments.confirmInstallment(submittedInstallment.id), 'Funds marked as received')}><Check size={14} />Confirm funds received</button><button className="btn" disabled={Boolean(busy)} onClick={() => { const reason = window.prompt('Why is this payment reference being rejected?'); if (reason) run('reject', () => payments.rejectInstallment(submittedInstallment.id, reason), 'Reference returned to buyer'); }}>Reject reference</button></div>;
  } else if (termsReady && !securityReady && deal.payment_plan === 'bank_secured') {
    nextTitle = isBuyer ? 'Submit external bank security' : 'Check and accept external bank security';
    nextCopy = 'The seller checks the bank instrument outside CocoaTrace. Acceptance does not confirm payment receipt.';
    nextAction = <button className="btn btn-primary" onClick={() => navigate(`/payments/${deal.payment_request_id}`)}>Open bank security</button>;
  } else if (dispatched && !deal.documents_presented_at && (deal.installments || []).some((item: any) => item.status === 'awaiting_trigger' && item.due_trigger === 'documents_presented')) {
    nextTitle = isSeller ? 'Present the trade document set' : 'Awaiting supplier trade documents';
    nextCopy = 'Validated, scan-clean invoice, packing list and transport documents make the remaining payment due. CIF/CIP also require insurance evidence.';
    nextAction = <button className="btn btn-primary" onClick={() => navigate(`/contracts/${deal.id}`)}>Open trade documents</button>;
  } else if (!dispatchReady) {
    nextTitle = 'Dispatch remains blocked'; nextCopy = 'The selected payment protection condition has not yet been verified.';
  } else if (!dispatched && deal.shipment_id) {
    nextTitle = 'Payment gate cleared—prepare dispatch'; nextCopy = 'The contract can now move into loading and dispatch. Record progress in the connected transport workspace.';
    nextAction = <button className="btn btn-primary" onClick={() => navigate(`/shipments/${deal.shipment_id}`)}><Ship size={14} />Continue to transport</button>;
  } else if (!delivered && deal.shipment_id) {
    nextTitle = 'Continue transport progress'; nextCopy = `The current milestone is ${pretty(deal.current_milestone)}.`;
    nextAction = <button className="btn btn-primary" onClick={() => navigate(`/shipments/${deal.shipment_id}`)}><Ship size={14} />Record progress</button>;
  } else if (!settled) {
    nextTitle = 'Complete the remaining payment'; nextCopy = 'Delivery is recorded. Buyer acceptance and seller-verified payments are both required to close the deal.';
    nextAction = deal.payment_request_id ? <button className="btn btn-primary" onClick={() => navigate(`/payments/${deal.payment_request_id}`)}><WalletCards size={14} />Open payment schedule</button> : null;
  } else {
    nextTitle = 'Trade completed'; nextCopy = 'Delivery and seller-verified settlement are recorded, and custody has transferred to the buyer.';
  }

  const exportLog = () => {
    const payload = { contractId: deal.id, status: deal.status, seller: deal.seller_name, buyer: deal.buyer_name, quantityKg: Number(deal.quantity_kg), pricePerKg: Number(deal.price_per_kg), incoterm: deal.incoterm, paymentPlan: deal.payment_plan, paymentStatus: deal.payment_status, amountConfirmed: Number(deal.amount_confirmed || 0), dispatchCleared: dispatchReady, shipmentId: deal.shipment_id || null, currentMilestone: deal.current_milestone || null, exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cocoatrace-deal-${String(deal.id).slice(0, 8)}-log.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <Layout currentPage="deal-room" actions={<button className="btn" onClick={() => navigate(`/contracts/${deal.id}`)}><Settings size={14} />Agreement & documents</button>}>
    <button className="mb-4 inline-flex items-center gap-2 text-xs text-text-muted hover:text-white" onClick={() => navigate('/contracts')}><ArrowLeft size={14} />All orders & deals</button>
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Shared deal workspace</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">{deal.seller_name} → {deal.buyer_name}</h2><p className="mt-3 text-sm text-text-muted">One workflow for agreement, documents, payment protection, dispatch, delivery and settlement.</p></div><StatusBadge status={deal.status} /></section>

    <section className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="grid gap-3 md:grid-cols-5">{stages.map((stage, index) => <div key={stage.label} className={`rounded-2xl border p-4 ${stage.done ? 'border-brand-400/30 bg-brand-400/5' : index === currentStage ? 'border-amber-300/30 bg-amber-300/5' : 'border-border bg-surface-darker'}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${stage.done ? 'bg-brand-400 text-emerald-950' : index === currentStage ? 'border border-amber-300 text-amber-300' : 'bg-white/5 text-text-muted'}`}>{stage.done ? <Check size={14} /> : index + 1}</span><div className="mt-3 text-xs font-semibold">{stage.label}</div><div className="mt-1 text-[9px] text-text-muted">{stage.done ? 'Completed' : index === currentStage ? 'Current stage' : 'Upcoming'}</div></div>)}</div></section>

    <section className="mt-5 rounded-3xl border border-brand-400/25 bg-brand-400/5 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">Best next action</div><h3 className="mt-1 text-lg font-bold">{nextTitle}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-text-muted">{nextCopy}</p></div><div className="w-full lg:w-auto lg:min-w-[310px]">{nextAction}</div></div></section>

    <div className="mt-5"><ContractCancellation contractId={deal.id} organizationId={user?.organizationId || ''} onChanged={refresh} /></div>
    {delivered && <div className="mt-5"><DeliveryAcceptance contractId={deal.id} organizationId={user?.organizationId || ''} onChanged={refresh} /></div>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
      <section className="space-y-5">
        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Dispatch release</div><h3 className="mt-1 text-lg font-bold">What must be true before goods leave</h3></div><span className={`badge ${dispatchReady ? 'badge-green' : 'badge-amber'}`}>{dispatchReady ? 'Cleared' : 'Blocked'}</span></div><div className="mt-5 space-y-2"><Condition icon={FileText} title="Payment terms agreed" copy={PLAN_LABELS[deal.payment_plan] || pretty(deal.payment_plan)} done={termsReady} /><Condition icon={WalletCards} title="Required funds seller-verified" copy={`${fmtMoney(Number(deal.amount_confirmed || 0), deal.currency)} confirmed of ${fmtMoney(Number(deal.dispatch_required_amount || 0), deal.currency)} required before dispatch`} done={moneyReady} /><Condition icon={BadgeCheck} title="External bank security accepted by seller" copy={deal.payment_plan === 'bank_secured' ? `Security status: ${pretty(deal.security_status)}` : 'Not required for this payment plan'} done={securityReady} /></div>{termsReady && Number(deal.dispatch_required_amount || 0) === 0 && deal.payment_plan !== 'bank_secured' && <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-3 text-[11px] leading-5 text-blue-200">This plan intentionally permits dispatch before cash receipt. Payment becomes due {deal.payment_plan === 'pay_after_delivery' ? 'after delivery' : 'against the agreed trade documents'}.</div>}{deal.dispatch_exception && <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">Exceptional dispatch was authorized: {deal.dispatch_exception_reason}</div>}</div>

        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Connected operations</div><h3 className="mt-1 text-lg font-bold">Payment, documents and transport</h3></div><button className="btn btn-sm" onClick={exportLog}><Download size={13} />Export log</button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Operation icon={WalletCards} title="Payment" value={pretty(deal.payment_status)} detail={`${fmtMoney(Number(deal.amount_confirmed || 0), deal.currency)} confirmed`} action="Open schedule" onClick={() => navigate(`/payments/${deal.payment_request_id}`)} /><Operation icon={LockKeyhole} title="Controlled documents" value={controlledDocsReleased ? 'Released' : 'Protected'} detail={`${(deal.documents || []).length} shared document${(deal.documents || []).length === 1 ? '' : 's'}`} action="Manage documents" onClick={() => navigate(`/contracts/${deal.id}`)} /><Operation icon={Ship} title="Transport" value={pretty(deal.current_milestone || 'planning')} detail={deal.transport_coordinator_name || 'Coordinator assigned'} action="Open transport" onClick={() => navigate(`/shipments/${deal.shipment_id}`)} /></div></div>
      </section>

      <section className="space-y-5"><div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Commercial agreement</div><h3 className="mt-1 text-lg font-bold">Contract summary</h3><dl className="mt-5 space-y-3 text-xs"><Term label="Quantity" value={`${Number(deal.quantity_kg).toLocaleString()} kg`} /><Term label="Unit price" value={fmtMoney(Number(deal.price_per_kg), deal.currency) + '/kg'} /><Term label="Trade value" value={fmtMoney(total, deal.currency)} /><Term label="Incoterm" value={deal.incoterm} /><Term label="Payment plan" value={PLAN_LABELS[deal.payment_plan] || pretty(deal.payment_plan)} /><Term label="Platform fee" value={`${fmtMoney(Number(deal.platform_fee_amount || 0), deal.currency)} · ${deal.fee_payer || 'seller'}`} /></dl><button className="btn mt-5 w-full justify-center" onClick={() => navigate(`/contracts/${deal.id}`)}><FileText size={14} />Agreement & document details</button></div><div className="flex items-start gap-3 rounded-3xl border border-border bg-surface-darker p-5 text-xs leading-5 text-text-muted"><Landmark size={18} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="font-semibold text-white">Funds remain with regulated providers</div><p className="mt-1">CocoaTrace coordinates conditions, references and verification. It does not hold customer money or present itself as escrow.</p></div></div></section>
    </div>
  </Layout>;
}

function pretty(value: string) { return String(value || '—').split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
function Condition({ icon: Icon, title, copy, done }: { icon: typeof FileText; title: string; copy: string; done: boolean }) { return <div className="flex gap-3 rounded-2xl border border-border bg-surface-darker p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}>{done ? <Check size={15} /> : <Circle size={14} />}</span><div><div className="text-xs font-semibold">{title}</div><div className="mt-1 text-[10px] leading-5 text-text-muted">{copy}</div></div></div>; }
function Operation({ icon: Icon, title, value, detail, action, onClick }: { icon: typeof Ship; title: string; value: string; detail: string; action: string; onClick: () => void }) { return <div className="rounded-2xl border border-border bg-surface-darker p-4"><Icon size={17} className="text-brand-400" /><div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">{title}</div><div className="mt-1 text-sm font-semibold">{value}</div><div className="mt-1 text-[10px] text-text-muted">{detail}</div><button className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300" onClick={onClick}>{action}<ArrowRight size={12} /></button></div>; }
function Term({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0"><dt className="text-text-muted">{label}</dt><dd className="text-right font-mono text-white">{value}</dd></div>; }
