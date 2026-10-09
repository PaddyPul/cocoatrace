import { useEffect, useState } from 'react';
import { evidence, recalls } from '../../api';
import { RecallResponse } from '../../types';
import { useAuthCtx } from '../auth/AuthProvider';

const quantityFields = [
  ['quarantinedKg', 'quarantined_kg', 'Quarantined'], ['returnedKg', 'returned_kg', 'Returned'],
  ['destroyedKg', 'destroyed_kg', 'Destroyed'], ['correctedKg', 'corrected_kg', 'Corrected'],
  ['releasedKg', 'released_kg', 'Released'],
] as const;
type Quantities = Record<typeof quantityFields[number][0], string>;
const emptyQuantities: Quantities = { quarantinedKg: '0', returnedKg: '0', destroyedKg: '0', correctedKg: '0', releasedKg: '0' };

export default function RecallResponsePanel({ recallId, onChanged }: { recallId: string; onChanged: () => void }) {
  const { canDo } = useAuthCtx();
  const [data, setData] = useState<RecallResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState('');
  const [holdingId, setHoldingId] = useState('');
  const [quantities, setQuantities] = useState<Quantities>(emptyQuantities);
  const [recoveryNote, setRecoveryNote] = useState('');
  const [contactStatus, setContactStatus] = useState<'contacted' | 'unreachable' | 'escalated'>('contacted');
  const [contactNote, setContactNote] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const refresh = async () => setData(await recalls.response(recallId));
  useEffect(() => { setData(null); setError(''); refresh().catch(err => setError(err.message)); }, [recallId]);
  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await operation(); await refresh(); onChanged(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const ownHoldings = data?.holdings.filter(holding => holding.holder_organization_id === data.myOrganizationId) || [];
  const selectedHolding = ownHoldings.find(holding => holding.id === holdingId);
  const active = data?.notice.status === 'active';
  const chooseHolding = (id: string) => {
    setHoldingId(id);
    const previous = data?.recoveries.find(recovery => recovery.holding_id === id);
    setQuantities(Object.fromEntries(quantityFields.map(([key, stored]) => [key, String(previous?.[stored] || 0)])) as Quantities);
    setRecoveryNote(previous?.note || '');
  };
  const saveRecovery = () => {
    if (!selectedHolding) return;
    const values = Object.fromEntries(quantityFields.map(([key]) => [key, Number(quantities[key])])) as Record<keyof Quantities, number>;
    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0) || Object.values(values).reduce((sum, value) => sum + value, 0) > Number(selectedHolding.quantity_kg)) {
      setError('Use nonnegative quantities totaling no more than the affected holding.'); return;
    }
    void act(() => recalls.recovery(recallId, holdingId, { ...values, note: recoveryNote }));
  };

  return <section className="mt-4 space-y-4 rounded-xl border border-border bg-surface-darker p-4" aria-label="Recall response">
    <h3 className="font-semibold">Recall response and recovery</h3>
    {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
    {!data ? <p className="text-xs text-text-muted">Loading response records…</p> : <>
      <p className="text-xs text-text-secondary">Acknowledgement confirms that you received the instructions. It does not release material or complete the recall.</p>
      <div className="space-y-2">{data.participants.map(participant => <div key={participant.organization_id} className="rounded border border-border p-3 text-xs">
        <strong>{participant.organization_name}</strong><div className="mt-1">{participant.acknowledged_at ? 'Acknowledged' : 'Awaiting acknowledgement'} · Contact: {participant.contact_status}</div>
        {participant.eligible_contact_count === 0 && <p className="mt-1 text-amber-300">No eligible contact account is available. Escalate through a verified contact channel; email status is not acknowledgement.</p>}
        <div className="mt-1 text-text-muted">Email delivery: {participant.email_statuses.length ? participant.email_statuses.join(', ') : 'No delivery recorded'}</div>
        {participant.acknowledgement_note && <p className="mt-1">{participant.acknowledgement_note}</p>}
        {active && participant.organization_id === data.myOrganizationId && !participant.acknowledged_at && <div className="mt-3 flex flex-wrap gap-2"><input aria-label="Acknowledgement note" className="form-input flex-1" value={acknowledgement} onChange={event => setAcknowledgement(event.target.value)} placeholder="How you are following the recall instructions" /><button className="btn btn-sm" disabled={busy} onClick={() => act(() => recalls.acknowledge(recallId, acknowledgement))}>Acknowledge instructions</button></div>}
        {active && data.canManage && <button className="btn btn-sm mt-2" disabled={busy} onClick={() => act(() => recalls.contact(recallId, participant.organization_id, { status: contactStatus, note: contactNote }))}>Record contact with {participant.organization_name}</button>}
      </div>)}</div>
      {active && data.canManage && <div className="flex flex-wrap gap-2"><label className="text-xs">Contact result<select className="form-select" value={contactStatus} onChange={event => setContactStatus(event.target.value as typeof contactStatus)}><option value="contacted">Contacted</option><option value="unreachable">Unreachable</option><option value="escalated">Escalated</option></select></label><label className="flex-1 text-xs">Contact note<input className="form-input" value={contactNote} onChange={event => setContactNote(event.target.value)} /></label></div>}
      {data.holdings.length > 0 && <div><h4 className="text-sm font-semibold">Affected inventory accounting</h4><p className="mt-1 text-xs text-text-muted">Record the current disposition of the entire holding. Saving replaces its previous quantities. Returned or destroyed material stays blocked; partial segregation is not supported.</p><div className="mt-2 space-y-2">{data.holdings.map(holding => {
        const recovery = data.recoveries.find(item => item.holding_id === holding.id);
        return <div key={holding.id} className="rounded border border-border p-2 text-xs"><strong>Holding {holding.id.slice(0, 8)}</strong> · {Number(holding.quantity_kg).toLocaleString()} kg{recovery && <p className="mt-1">{quantityFields.map(([, stored, label]) => `${label}: ${Number(recovery[stored])} kg`).join(' · ')} · {recovery.note}</p>}</div>;
      })}</div></div>}
      {active && ownHoldings.length > 0 && <div className="space-y-3"><label className="block text-xs">Your affected holding<select aria-label="Your affected holding" className="form-select" value={holdingId} onChange={event => chooseHolding(event.target.value)}><option value="">Select holding…</option>{ownHoldings.map(holding => <option key={holding.id} value={holding.id}>{holding.id.slice(0, 8)} · {Number(holding.quantity_kg)} kg</option>)}</select></label>{selectedHolding && <><div className="grid gap-2 sm:grid-cols-5">{quantityFields.map(([key, , label]) => <label key={key} className="text-xs">{label} (kg)<input className="form-input" type="number" min="0" step="0.001" value={quantities[key]} onChange={event => setQuantities({ ...quantities, [key]: event.target.value })} /></label>)}</div><label className="block text-xs">Recovery note<textarea className="form-input" value={recoveryNote} onChange={event => setRecoveryNote(event.target.value)} /></label><button className="btn btn-sm" disabled={busy} onClick={saveRecovery}>Save recovery accounting</button></>}</div>}
      <div><h4 className="text-sm font-semibold">Shared response evidence</h4><div className="mt-2 space-y-2">{data.evidence.map(item => <div key={item.id} className="flex gap-2 text-xs">{data.canManage && active && <input aria-label={`Use ${item.file_name} for resolution`} type="checkbox" checked={evidenceIds.includes(item.id)} onChange={event => setEvidenceIds(event.target.checked ? [...evidenceIds, item.id] : evidenceIds.filter(id => id !== item.id))} />}<button className="text-brand-300 underline" onClick={() => evidence.download(item.id, item.file_name).catch(err => setError(err.message))}>{item.file_name}</button></div>)}</div>
        {active && canDo('evidence.upload') && <div className="mt-3 flex flex-wrap gap-2"><input aria-label="Response evidence file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files?.[0] || null)} /><button className="btn btn-sm" disabled={!file || busy} onClick={() => act(() => evidence.upload(file!, { linkedEntityType: 'recall', linkedEntityId: recallId, claimDescription: 'Recall response evidence' }))}>Upload response evidence</button></div>}
      </div>
      {data.canManage && active && <div className="space-y-2 border-t border-border pt-4"><h4 className="text-sm font-semibold">Resolve after verified recovery</h4><p className="text-xs text-text-muted">Every affected organization must acknowledge the recall, and all held inventory must be fully accounted for with no remaining quarantine. Select supporting evidence above. Resolution does not republish withdrawn listings.</p><label className="block text-xs">Resolution reason<textarea className="form-input" value={resolutionReason} onChange={event => setResolutionReason(event.target.value)} placeholder="Describe the verified recovery and decision (at least 10 characters)" /></label><button className="btn btn-sm" disabled={busy || resolutionReason.trim().length < 10 || !evidenceIds.length} onClick={() => act(() => recalls.resolve(recallId, { reason: resolutionReason, evidenceIds }))}>Resolve recall with evidence</button></div>}
      {!active && <p className="text-xs text-text-muted">This recall is resolved. Response records remain available for audit; returned and destroyed material stays blocked.</p>}
    </>}
  </section>;
}
