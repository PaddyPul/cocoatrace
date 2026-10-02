import { useState } from 'react';
import { payments, type PaymentIssueType, type PaymentOperationsData } from '../../api';
import { fmtMoney } from '../shared/helpers';

const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\./g, ' · ');
const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Waiting for the agreed trigger';
export const hasActivePaymentIssue = (data: PaymentOperationsData | null) => Boolean(data?.issues.some(issue => issue.status !== 'resolved'));

interface Props {
  payment: any;
  operations: PaymentOperationsData;
  organizationId: string;
  isBuyer: boolean;
  isSeller: boolean;
  busy: boolean;
  onAction: (name: string, action: () => Promise<unknown>, message: string) => Promise<void>;
}

export default function PaymentOperations({ payment, operations, organizationId, isBuyer, isSeller, busy, onAction }: Props) {
  const [issueType, setIssueType] = useState<PaymentIssueType>('payment_dispute');
  const [installmentId, setInstallmentId] = useState('');
  const [reason, setReason] = useState('');
  const [proposedReference, setProposedReference] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const active = operations.issues.find(issue => issue.status !== 'resolved');
  const closedContract = ['settled', 'cancelled'].includes(payment.contract_status);
  const eligible = operations.installments.filter(item => issueType === 'reference_correction' ? item.status === 'payment_submitted' : issueType === 'receipt_reversal' ? item.status === 'paid' : true);
  const overdue = operations.installments.some(item => item.dueState === 'overdue' && item.status === 'due');
  const canPropose = active && (active.issue_type === 'payment_dispute' || (active.issue_type === 'reference_correction' && isBuyer) || (active.issue_type === 'receipt_reversal' && isSeller));
  const canApprove = active?.status === 'resolution_proposed' && active.resolution_proposed_by_organization_id && active.resolution_proposed_by_organization_id !== organizationId;

  return <section aria-label="Payment operations" className="space-y-5">
    <div className="bg-surface border border-border rounded p-5">
      <h2 className="text-sm font-semibold mb-3">Due dates and reminders</h2>
      <div className="space-y-2">{operations.installments.map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 text-xs">
        <span>{pretty(item.installment_type)} · {fmtMoney(Number(item.amount_due), payment.currency)}</span>
        <span className={item.dueState === 'overdue' ? 'text-red-400' : 'text-text-muted'}>{pretty(item.dueState)} · {date(item.due_at)}</span>
      </div>)}</div>
      {isSeller && overdue && !active && <button className="btn text-xs mt-3" disabled={busy} onClick={() => onAction('reminder', () => payments.remind(payment.id), 'Reminder recorded. Repeating today does not create another reminder.')}>Send overdue reminder</button>}
      <p className="text-xs text-text-muted mt-3">Reminders appear in this workspace. No automatic bank transfer or email is sent.</p>
      {operations.reminders.length > 0 && <ul className="mt-3 space-y-2 text-xs">{operations.reminders.map(reminder => <li key={reminder.id}>Payment reminder · {date(reminder.created_at)}</li>)}</ul>}
    </div>

    <div className="bg-surface border border-border rounded p-5">
      <h2 className="text-sm font-semibold mb-3">Disputes and corrections</h2>
      <p className="text-xs text-text-muted mb-3">Both parties must agree to a resolution. This records a correction; it does not refund money, move funds or automatically reverse custody.</p>
      {active ? <div className="space-y-3">
        <div role="status" className="border border-amber-500/40 rounded p-3 text-xs"><strong>Payment issue hold</strong><p className="mt-1">Payment and dispatch actions are paused while this issue is active.</p><p className="mt-2">{pretty(active.issue_type)} · {pretty(active.status)}</p><p className="mt-1">{active.reason}</p>{active.proposed_reference && <p className="mt-1">Proposed reference: {active.proposed_reference}</p>}</div>
        {active.resolution_note && <p className="text-xs">Proposed resolution: {active.resolution_note}</p>}
        {canPropose && active.status !== 'resolution_proposed' && <div className="space-y-2"><label className="block text-xs" htmlFor="payment-resolution-note">Resolution explanation</label><textarea id="payment-resolution-note" className="form-input" value={resolutionNote} onChange={event => setResolutionNote(event.target.value)} /><button className="btn btn-primary text-xs" disabled={busy || resolutionNote.trim().length < 10} onClick={() => onAction('propose-resolution', () => payments.proposeIssueResolution(active.id, resolutionNote.trim()), 'Resolution proposed; awaiting the other party')}>Propose resolution</button></div>}
        {canApprove && <button className="btn btn-primary text-xs" disabled={busy} onClick={() => onAction('approve-resolution', () => payments.approveIssueResolution(active.id), 'Resolution approved')}>Approve resolution</button>}
        {active.status === 'resolution_proposed' && !canApprove && <p className="text-xs text-text-muted">Awaiting approval from the other organization.</p>}
      </div> : (isBuyer || isSeller) && <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        onAction('raise-issue', () => payments.raiseIssue(payment.id, { issueType, reason: reason.trim(), ...(installmentId ? { installmentId } : {}), ...(issueType === 'reference_correction' ? { proposedReference: proposedReference.trim() } : {}) }), 'Payment issue opened');
      }}>
        <label className="block text-xs" htmlFor="payment-issue-type">Issue type</label>
        <select id="payment-issue-type" className="form-input" value={issueType} onChange={event => { setIssueType(event.target.value as PaymentIssueType); setInstallmentId(''); }}><option value="payment_dispute">Payment dispute</option>{isBuyer && !closedContract && operations.installments.some(item => item.status === 'payment_submitted') && <option value="reference_correction">Correct submitted reference</option>}{isSeller && !closedContract && operations.installments.some(item => item.status === 'paid') && <option value="receipt_reversal">Correct confirmed receipt</option>}</select>
        <label className="block text-xs" htmlFor="payment-issue-installment">Installment</label><select id="payment-issue-installment" className="form-input" value={installmentId} onChange={event => setInstallmentId(event.target.value)} required={issueType !== 'payment_dispute'}><option value="">{issueType === 'payment_dispute' ? 'Whole payment request' : 'Choose installment'}</option>{eligible.map(item => <option key={item.id} value={item.id}>{pretty(item.installment_type)} · {fmtMoney(Number(item.amount_due), payment.currency)}</option>)}</select>
        {issueType === 'reference_correction' && <><label className="block text-xs" htmlFor="payment-proposed-reference">Corrected payment reference</label><input id="payment-proposed-reference" className="form-input" value={proposedReference} onChange={event => setProposedReference(event.target.value)} minLength={3} required /></>}
        <label className="block text-xs" htmlFor="payment-issue-reason">Issue explanation</label><textarea id="payment-issue-reason" className="form-input" value={reason} onChange={event => setReason(event.target.value)} minLength={10} required />
        <button className="btn text-xs" disabled={busy || reason.trim().length < 10 || (issueType !== 'payment_dispute' && !installmentId) || (issueType === 'reference_correction' && proposedReference.trim().length < 3)}>Raise payment issue</button>
      </form>}
      {operations.issues.filter(issue => issue.status === 'resolved').map(issue => <div key={issue.id} className="border-t border-border pt-3 mt-3 text-xs"><strong>Resolved: {pretty(issue.issue_type)}</strong><p>{issue.reason}</p><p>{issue.resolution_note}</p></div>)}
    </div>

    <div className="bg-surface border border-border rounded p-5">
      <h2 className="text-sm font-semibold mb-3">Payment history</h2>
      {operations.timeline.length === 0 ? <p className="text-xs text-text-muted">No payment events recorded yet.</p> : <ol className="space-y-3">{operations.timeline.map(event => <li key={event.id} className="text-xs border-l-2 border-border pl-3"><div className="font-medium">{pretty(event.action)}</div><div className="text-text-muted">{date(event.occurred_at)} · {event.actor_name || 'Recorded system action'}</div><EventDetails metadata={event.metadata} /></li>)}</ol>}
    </div>
  </section>;
}

function EventDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const allowed = ['reference', 'previousReference', 'newReference', 'reason', 'note', 'resolutionNote', 'amount', 'issueType', 'paymentPlan', 'previousStatus', 'newStatus'];
  return <>{allowed.map(key => metadata[key] != null && <div key={key} className="mt-1">{pretty(key.replace(/([A-Z])/g, ' $1'))}: {String(metadata[key])}</div>)}</>;
}
