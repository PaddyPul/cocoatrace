import { useCallback, useEffect, useState } from 'react';
import { contracts, type CancellationState } from '../../api';
import { usePermission } from '../../hooks/usePermission';
export default function ContractCancellation({contractId, organizationId, onChanged}: {contractId: string; organizationId: string; onChanged: () => Promise<void>}) {
  const { canAny } = usePermission();
  const canAct = canAny('offer.create', 'offer.respond');
  const [state, setState] = useState<CancellationState | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setState(await contracts.cancellation(contractId)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load cancellation status'); }
  }, [contractId]);
  useEffect(() => { void load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, [load]);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); setReason(''); await load(); await onChanged(); }
    catch (e) { const message = e instanceof Error ? e.message : 'Cancellation action failed'; await load(); setError(message); }
    finally { setBusy(false); }
  };
  const pending = state?.requests.find(r => r.status === 'requested');
  const isReviewer = pending && pending.requested_by_organization_id !== organizationId;
  return <section className="bg-surface border border-border rounded p-5 space-y-3" aria-label="Trade cancellation">
    <h3 className="text-sm font-semibold">Cancel an unstarted trade</h3>
    <p className="text-xs text-text-muted">Both organizations must agree. Only trades without payment, security or transport activity can be cancelled here. Approval releases the committed inventory; it does not publish a listing or refund funds.</p>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    {!state && !error && <p role="status">Loading cancellation status…</p>}
    {state?.contractStatus === 'cancelled' ? <p role="status">Trade cancelled. The supplier can review the released inventory and create a new listing.</p> : <>
      {pending && <div className="space-y-2"><p className="text-xs">Cancellation requested: {pending.reason}</p>{isReviewer && canAct ? <><p className="text-xs">Approve only after agreeing any external obligations with the other party.</p><button className="btn btn-sm" disabled={busy || !!state?.blockedReason} onClick={() => void run(() => contracts.reviewCancellation(contractId, pending.id, true))}>Approve cancellation and release inventory</button><button className="btn btn-sm ml-2" disabled={busy} onClick={() => void run(() => contracts.reviewCancellation(contractId, pending.id, false))}>Keep trade open</button></> : <p role="status" className="text-xs">Awaiting the other organization’s decision. Inventory remains committed.</p>}</div>}
      {state && !canAct && <p className="text-xs text-text-muted">A member with offer creation or response permission must request or review cancellation.</p>}
      {state?.blockedReason && <p className="text-xs text-text-muted">{state.blockedReason}</p>}
      {state && canAct && !pending && !state.blockedReason && <div className="space-y-2"><label className="form-label" htmlFor="cancellation-reason">Reason for cancellation</label><textarea id="cancellation-reason" className="form-input" value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /><button className="btn btn-sm" disabled={busy || [...reason.trim()].length < 10} onClick={() => void run(() => contracts.requestCancellation(contractId, reason))}>{busy ? 'Saving…' : 'Request cancellation'}</button></div>}
    </>}
    {state?.requests.filter(r => r.status !== 'requested').map(r => <p key={r.id} className="text-xs text-text-muted">Cancellation {r.status}: {r.reason}</p>)}
  </section>;
}
