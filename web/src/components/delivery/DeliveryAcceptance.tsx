import { useCallback, useEffect, useState } from 'react';
import { contracts, evidence } from '../../api';

type DiscrepancyKind = 'shortage' | 'damage' | 'rejection';
interface DeliveryState {
  contract: { id: string; quantity_kg: string | number; status: string; buyer_organization_id: string; seller_organization_id: string; current_milestone: string | null };
  acceptance: null | { received_quantity_kg: string | number; note: string; accepted_at: string };
  discrepancy: null | { id: string; status: 'open' | 'resolution_proposed' | 'resolved'; kind: DiscrepancyKind; received_quantity_kg: string | number; reason: string; evidence_ids: string[]; resolution_note: string | null; resolution_proposed_by_organization_id: string | null; resolved_at: string | null };
}
interface Props { contractId: string; organizationId: string; onChanged: () => void | Promise<void> }

/** Physical delivery and the buyer's acceptance are separate, auditable decisions. */
export default function DeliveryAcceptance({ contractId, organizationId, onChanged }: Props) {
  const [data, setData] = useState<DeliveryState | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<DiscrepancyKind>('shortage');
  const [reason, setReason] = useState('');
  const [proofIds, setProofIds] = useState<string[]>([]);
  const [proofNames, setProofNames] = useState<string[]>([]);
  const [resolutionNote, setResolutionNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const refresh = useCallback(async () => {
    const result = await contracts.delivery(contractId);
    setData(result);
  }, [contractId]);
  useEffect(() => { refresh().catch(error => setError(error.message)); }, [refresh]);
  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); await onChanged(); setMessage(success); }
    catch (error) { setError(error instanceof Error ? error.message : 'Delivery action failed'); }
    finally { setBusy(false); }
  };
  const uploadProof = async (file: File) => {
    setBusy(true); setError(''); setMessage('Uploading and scanning delivery evidence…');
    try {
      const item = await evidence.upload(file, { type: 'delivery_proof', linkedEntityType: 'contract', linkedEntityId: contractId });
      if (item.malware_scan_status !== 'clean') throw new Error('Evidence must finish malware scanning before reporting a discrepancy.');
      setProofIds(current => [...current, item.id]); setProofNames(current => [...current, file.name]);
      setMessage('Delivery evidence attached.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Evidence upload failed'); setMessage(''); }
    finally { setBusy(false); }
  };

  if (!data) return <section aria-label="Delivery acceptance" className="bg-surface border border-border rounded p-5"><h2 className="text-sm font-semibold">Delivery acceptance</h2>{error ? <p role="alert" className="text-xs text-red-400 mt-2">{error}</p> : <p className="text-xs text-text-muted mt-2">Loading delivery record…</p>}</section>;
  const buyer = organizationId === data.contract.buyer_organization_id;
  const supplier = organizationId === data.contract.seller_organization_id;
  const delivered = data.contract.current_milestone === 'delivered';
  const activeDiscrepancy = data.discrepancy && data.discrepancy.status !== 'resolved';
  const total = Number(data.contract.quantity_kg);
  const received = Number(quantity);
  const validQuantity = quantity.trim() !== '' && Number.isFinite(received) && received >= 0 && received <= total;
  const canAccept = buyer && delivered && !data.acceptance && !activeDiscrepancy && !['cancelled','settled'].includes(data.contract.status);

  return <section aria-label="Delivery acceptance" className="bg-surface border border-border rounded p-5 space-y-4">
    <div><h2 className="text-sm font-semibold">Delivery inspection and acceptance</h2><p className="text-xs text-text-muted mt-2">A delivered transport milestone does not confirm the quantity or condition. The buyer inspects the goods before accepting the full contract quantity of {total.toLocaleString()} kg.</p></div>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    {message && <p role="status" className="text-xs text-text-muted">{message}</p>}
    {data.contract.status === 'settled' && !data.acceptance && <p className="text-xs text-text-muted">Historical completed trade. No separate buyer acceptance record was captured by the earlier workflow.</p>}
    {data.acceptance ? <div className="text-xs border border-green-500/30 rounded p-3"><strong>Buyer accepted delivery</strong><p>{Number(data.acceptance.received_quantity_kg).toLocaleString()} kg · {new Date(data.acceptance.accepted_at).toLocaleString()}</p><p>{data.acceptance.note}</p></div> : !delivered && <p className="text-xs text-text-muted">Delivery acceptance becomes available after transport is recorded as delivered.</p>}

    {data.discrepancy && <div className="border border-amber-500/40 rounded p-3 space-y-2 text-xs">
      <strong>{activeDiscrepancy ? 'Delivery discrepancy hold' : 'Delivery discrepancy resolved'}</strong>
      <p>{data.discrepancy.kind} · {data.discrepancy.status.replace(/_/g, ' ')} · received {Number(data.discrepancy.received_quantity_kg).toLocaleString()} kg</p><p>{data.discrepancy.reason}</p><div className="flex gap-2 flex-wrap">{data.discrepancy.evidence_ids.map(id => <button key={id} type="button" className="btn text-xs" disabled={busy} onClick={() => act(() => evidence.download(id, 'delivery-evidence'), 'Delivery evidence downloaded.')}>Download supporting evidence</button>)}</div>
      {data.discrepancy.resolution_note && <p>Supplier resolution: {data.discrepancy.resolution_note}</p>}
      {activeDiscrepancy && <p>Trade completion and custody settlement are paused. Recording a resolution does not issue a refund, change the contract quantity or automatically reverse inventory.</p>}
      {supplier && data.discrepancy.status === 'open' && <form className="space-y-2" onSubmit={event => { event.preventDefault(); act(() => contracts.proposeDeliveryResolution(contractId, resolutionNote.trim()), 'Resolution proposed; awaiting buyer approval.'); }}><label className="block" htmlFor="delivery-resolution-note">Supplier resolution explanation</label><textarea id="delivery-resolution-note" className="form-input" value={resolutionNote} onChange={event => setResolutionNote(event.target.value)} required minLength={10} /><button className="btn btn-primary text-xs" disabled={busy || resolutionNote.trim().length < 10}>Propose delivery resolution</button></form>}
      {buyer && data.discrepancy.status === 'resolution_proposed' && <button className="btn btn-primary text-xs" disabled={busy} onClick={() => act(() => contracts.approveDeliveryResolution(contractId), 'Resolution approved. Inspect and separately accept delivery once the full quantity and condition match the contract.')}>Approve delivery resolution</button>}
      {data.discrepancy.status === 'resolved' && !data.acceptance && <p>Approval records your agreement to the resolution. Missing or rejected goods must be replaced before you separately accept the full delivery.</p>}
    </div>}

    {canAccept && <form className="space-y-3 border-t border-border pt-3" onSubmit={event => { event.preventDefault(); act(() => contracts.acceptDelivery(contractId, { receivedQuantityKg: received, note: note.trim() }), 'Delivery accepted. Payment and settlement follow the agreed plan.'); }}>
      <h3 className="text-xs font-semibold">Accept inspected delivery</h3><label className="block text-xs" htmlFor="delivery-accepted-quantity">Inspected quantity received (kg)</label><input id="delivery-accepted-quantity" className="form-input" type="number" min="0" step="0.001" max={total} value={quantity} onChange={event => setQuantity(event.target.value)} required />
      <label className="block text-xs" htmlFor="delivery-acceptance-note">Inspection note</label><textarea id="delivery-acceptance-note" className="form-input" value={note} onChange={event => setNote(event.target.value)} required minLength={10} />
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} required /><span>I inspected the full contract quantity and accept its condition.</span></label>
      <button className="btn btn-primary text-xs" disabled={busy || !validQuantity || received !== total || note.trim().length < 10 || !acknowledged}>Accept full delivery</button>
      {validQuantity && received !== total && <p className="text-xs text-text-muted">The quantity differs from the contract. Report a discrepancy below.</p>}
    </form>}

    {buyer && delivered && !data.acceptance && !activeDiscrepancy && !['cancelled','settled'].includes(data.contract.status) && <form className="space-y-3 border-t border-border pt-3" onSubmit={event => { event.preventDefault(); act(() => contracts.reportDiscrepancy(contractId, { kind, receivedQuantityKg: received, reason: reason.trim(), evidenceIds: proofIds }), 'Delivery discrepancy recorded. Settlement is paused pending resolution and buyer acceptance.'); }}>
      <h3 className="text-xs font-semibold">Report a delivery discrepancy</h3><label className="block text-xs" htmlFor="delivery-discrepancy-kind">Discrepancy type</label><select id="delivery-discrepancy-kind" className="form-input" value={kind} onChange={event => setKind(event.target.value as DiscrepancyKind)}><option value="shortage">Quantity shortage</option><option value="damage">Damaged goods</option><option value="rejection">Rejected goods</option></select>
      <label className="block text-xs" htmlFor="delivery-discrepancy-quantity">Actual received quantity (kg)</label><input id="delivery-discrepancy-quantity" className="form-input" type="number" min="0" step="0.001" max={total} value={quantity} onChange={event => setQuantity(event.target.value)} required />
      <label className="block text-xs" htmlFor="delivery-discrepancy-reason">Explain the discrepancy</label><textarea id="delivery-discrepancy-reason" className="form-input" value={reason} onChange={event => setReason(event.target.value)} required minLength={10} />
      <label className="block text-xs" htmlFor="delivery-discrepancy-proof">Delivery evidence (PDF, JPEG or PNG)</label><input id="delivery-discrepancy-proof" className="form-input" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) uploadProof(file); }} />
      {proofNames.length > 0 && <ul className="text-xs space-y-1">{proofNames.map((name, index) => <li key={proofIds[index]}>Attached: {name}</li>)}</ul>}
      <button className="btn text-xs" disabled={busy || !validQuantity || reason.trim().length < 10 || proofIds.length === 0 || (kind === 'shortage' && received >= total)}>Report delivery discrepancy</button>
    </form>}
  </section>;
}
