import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitBranch, Plus, X } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { recalls as recallsApi, traceability } from '../api';
import { MaterialLot, RecallImpactResult, RecallNotice, TraceBackResult } from '../types';
import { fmtDate, StatusBadge } from '../components/shared/helpers';
import { useToast } from '../components/shared/ToastProvider';
import { useAuthCtx } from '../components/auth/AuthProvider';

export default function RecallCenterPage() {
  const { toast } = useToast();
  const { canDo } = useAuthCtx();
  const canManageRecalls = canDo('recall.manage');
  const [items, setItems] = useState<RecallNotice[]>([]);
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [instructions, setInstructions] = useState('Stop distribution and hold the affected lot. Contact the issuing organization for instructions.');
  const [severity, setSeverity] = useState<'advisory' | 'warning' | 'critical'>('warning');
  const [recallLotId, setRecallLotId] = useState('');
  const [recallQuantity, setRecallQuantity] = useState('');
  const [traceMode, setTraceMode] = useState<'trace-back' | 'trace-forward'>('trace-forward');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [traceQuantity, setTraceQuantity] = useState('');
  const [traceBusy, setTraceBusy] = useState(false);
  const [traceResult, setTraceResult] = useState<TraceBackResult | RecallImpactResult | null>(null);

  const refresh = () => Promise.all([canManageRecalls ? recallsApi.list() : Promise.resolve([]), traceability.listLots()])
    .then(([recalls, allLots]) => {
      setItems(recalls); setLots(allLots);
      setSelectedLotId((current) => current || allLots[0]?.id || '');
      setRecallLotId((current) => current || allLots[0]?.id || '');
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, [canManageRecalls]);

  const calculateTrace = async () => {
    if (!selectedLotId) return;
    const quantity = traceQuantity ? Number(traceQuantity) : undefined;
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError('Trace quantity must be a positive number.');
      return;
    }
    setTraceBusy(true); setError(''); setTraceResult(null);
    try {
      setTraceResult(traceMode === 'trace-back'
        ? await traceability.traceBack(selectedLotId, quantity)
        : await traceability.traceForward(selectedLotId, quantity));
    } catch (err: any) { setError(err.message); } finally { setTraceBusy(false); }
  };

  const create = async () => {
    const quantity = recallQuantity ? Number(recallQuantity) : undefined;
    if (!referenceCode || !title || !reason || !instructions || !recallLotId) {
      setError('Reference, title, reason, instructions and a suspect lot are required.');
      return;
    }
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError('Suspect quantity must be a positive number.');
      return;
    }
    setBusy(true); setError('');
    try {
      await recallsApi.create({ referenceCode, title, reason, instructions, severity, lots: [{ lotId: recallLotId, quantityKg: quantity }] });
      setShowCreate(false); setReferenceCode(''); setTitle(''); setReason(''); setRecallQuantity('');
      toast('success', 'Recall activated — affected public profiles now show the notice');
      await refresh();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const resolve = async (id: string) => {
    setBusy(true);
    try {
      await recallsApi.resolve(id);
      toast('success', 'Recall resolved');
      await refresh();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return <Layout currentPage="recalls" actions={canManageRecalls ? <button className="btn btn-sm btn-danger" onClick={() => { setError(''); setShowCreate(true); }}><Plus size={13} /> Activate recall</button> : <span className="badge badge-blue">Investigation access</span>}>
    <div className="mb-5 rounded border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-200">
      <div className="flex items-start gap-3"><AlertTriangle size={18} className="shrink-0 text-yellow-400" /><div><strong className="block text-sm text-yellow-300">Investigate first. Activate with confidence.</strong><p className="mt-1 text-text-secondary">Trace any lot backward to its sources or forward to every descendant and recipient. {canManageRecalls ? 'When the scope is verified, activate a notice that immediately updates affected product profiles.' : 'Your role has investigation access; an authorized recall manager controls public notices.'}</p></div></div>
    </div>
    <section className="mb-5 rounded border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><GitBranch size={16} className="text-brand-400" /> Lot genealogy calculator</div><p className="mt-1 text-xs text-text-secondary">Calculate exact declared mass flow backward to source lots or forward to every descendant and recipient.</p></div><span className="badge badge-blue">quantity-aware</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_180px_auto]">
        <select className="form-select" value={traceMode} onChange={(event) => { setTraceMode(event.target.value as typeof traceMode); setTraceResult(null); }}><option value="trace-forward">Trace forward</option><option value="trace-back">Trace back</option></select>
        <select className="form-select" value={selectedLotId} onChange={(event) => { setSelectedLotId(event.target.value); setTraceResult(null); }}><option value="">Select a lot…</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode} · {lot.productName} · {Number(lot.quantityKg).toLocaleString()} kg</option>)}</select>
        <input className="form-input" inputMode="decimal" placeholder="Quantity (full lot)" value={traceQuantity} onChange={(event) => setTraceQuantity(event.target.value)} />
        <button className="btn btn-primary justify-center" disabled={!selectedLotId || traceBusy} onClick={calculateTrace}>{traceBusy ? 'Calculating…' : 'Calculate'}</button>
      </div>
      {traceResult && <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap gap-2 text-[10px]"><span className={`badge ${traceResult.exactness === 'declared' ? 'badge-green' : 'badge-amber'}`}>{traceResult.exactness} allocations</span>{traceResult.warnings.map((warning) => <span key={warning} className="badge badge-amber">{warning}</span>)}</div>
        {traceResult.direction === 'trace-forward' ? <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">{[
            ['Impacted lots', traceResult.totals.impactedLotCount],
            ['Terminal recall', `${traceResult.totals.leafRecallQuantityKg.toLocaleString()} kg`],
            ['Already distributed', `${traceResult.totals.distributedRecallQuantityKg.toLocaleString()} kg`],
            ['Recipients', traceResult.totals.recipientCount],
          ].map(([label, value]) => <div key={label} className="rounded-sm bg-surface-darker p-3"><div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>)}</div>
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Impacted lot</th><th>Type</th><th>Suspect-equivalent</th><th>Recall quantity</th><th>Depth</th></tr></thead><tbody>{traceResult.impactedLots.map((lot) => <tr key={lot.id}><td><div className="font-mono text-xs">{lot.lotCode}</div><div className="text-[10px] text-text-muted">{lot.productName}</div></td><td>{lot.lotType}</td><td>{Number(lot.sourceEquivalentKg).toLocaleString()} kg <span className="text-text-muted">({lot.sourceEquivalentPercent}%)</span></td><td className="font-semibold text-yellow-300">{Number(lot.recallQuantityKg).toLocaleString()} kg</td><td>{lot.relationshipDepth}</td></tr>)}</tbody></table></div>
          {traceResult.recipients.length > 0 && <div className="mt-4"><div className="form-label">Trace-forward recipients</div><div className="grid gap-2 md:grid-cols-2">{traceResult.recipients.map((recipient) => <div key={recipient.organizationId} className="rounded-sm border border-border p-3 text-xs"><strong>{recipient.name}</strong><div className="mt-1 text-text-muted">{recipient.recallQuantityKg.toLocaleString()} kg across {recipient.distributionCount} distribution{recipient.distributionCount === 1 ? '' : 's'}</div></div>)}</div></div>}
        </> : <>
          <div className="mb-3 text-xs text-text-secondary">To produce <strong>{traceResult.queryQuantityKg.toLocaleString()} kg</strong> of {traceResult.targetLot.lotCode}, these source quantities are required:</div>
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Source lot</th><th>Product</th><th>Required quantity</th><th>Share of source lot</th><th>Confidence</th></tr></thead><tbody>{traceResult.sourceLots.map((lot) => <tr key={lot.id}><td className="font-mono text-xs">{lot.lotCode}</td><td>{lot.productName}</td><td className="font-semibold">{Number(lot.quantityRequiredKg).toLocaleString()} kg</td><td>{lot.percentOfLot}%</td><td>{lot.allocationConfidence}</td></tr>)}</tbody></table></div>
        </>}
        <details className="mt-4 text-[10px] text-text-muted"><summary className="cursor-pointer">Calculation assumptions</summary><ul className="mt-2 list-disc space-y-1 pl-5">{traceResult.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>
      </div>}
    </section>
    {error && !showCreate && <div className="mb-4 rounded-sm border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">{error}</div>}
    {!canManageRecalls ? <div className="rounded-2xl border border-border bg-surface p-5 text-xs text-text-secondary"><strong className="block text-sm text-text-primary">Recall notices are managed by authorized roles</strong><p className="mt-1">You can use all genealogy investigation tools above. Contact a regulator, administrator or your organization’s recall manager to activate or resolve a public notice.</p></div> : loading ? <div className="loading"><div className="spinner" /><div>Loading recalls…</div></div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><div className="empty-title">No recall notices</div><p>No active or resolved recalls are recorded.</p></div> : <div className="space-y-3">
      {items.map((recall) => <article key={recall.id} className={`rounded border p-5 ${recall.status === 'active' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-surface'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><StatusBadge status={recall.status} /><span className={`badge ${recall.severity === 'critical' ? 'badge-red' : recall.severity === 'warning' ? 'badge-amber' : 'badge-blue'}`}>{recall.severity}</span><span className="font-mono text-[10px] text-text-muted">{recall.reference_code}</span></div><h2 className="mt-3 text-base font-semibold">{recall.title}</h2><p className="mt-1 text-xs text-text-secondary">{recall.reason}</p></div>{recall.status === 'active' && <button className="btn btn-sm" disabled={busy} onClick={() => resolve(recall.id)}><CheckCircle2 size={13} /> Resolve</button>}</div>
        <div className="mt-4 rounded-sm bg-surface-darker p-3 text-xs"><span className="font-semibold">Instructions: </span>{recall.instructions}</div>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-text-muted"><span>{recall.affected_lots?.length || 0} affected lot{recall.affected_lots?.length === 1 ? '' : 's'}</span><span>{recall.batch_ids.length} source batch{recall.batch_ids.length === 1 ? '' : 'es'}</span><span>Issued by {recall.issued_by}</span><span>{fmtDate(recall.initiated_at)}</span></div>
      </article>)}
    </div>}

    {showCreate && <div className="modal-overlay" onClick={() => !busy && setShowCreate(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
      <div className="mb-5 flex items-start justify-between"><div><div className="modal-title">Activate recall</div><p className="modal-sub mb-0">This change is immediately visible on published product pages.</p></div><button className="btn btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button></div>
      <div className="space-y-3">
        <input className="form-input" placeholder="Reference code *" value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} />
        <input className="form-input" placeholder="Public notice title *" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className="form-input min-h-20" placeholder="Reason *" value={reason} onChange={(event) => setReason(event.target.value)} />
        <textarea className="form-input min-h-24" placeholder="Consumer/operator instructions *" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        <select className="form-select" value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option value="advisory">Advisory</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
        <div><div className="form-label">Suspect lot *</div><select className="form-select" value={recallLotId} onChange={(event) => setRecallLotId(event.target.value)}><option value="">Select a lot…</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode} · {lot.productName} · {Number(lot.quantityKg).toLocaleString()} kg</option>)}</select></div>
        <div><div className="form-label">Suspect quantity (kg)</div><input className="form-input" inputMode="decimal" placeholder="Leave blank for the full lot" value={recallQuantity} onChange={(event) => setRecallQuantity(event.target.value)} /><p className="mt-1 text-[10px] text-text-muted">The server recalculates every descendant. Any commingled descendant is recalled in full while suspect-equivalent mass remains separately recorded.</p></div>
        {error && <div className="rounded-sm border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex gap-2 pt-2"><button className="btn flex-1 justify-center" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</button><button className="btn btn-danger flex-1 justify-center" onClick={create} disabled={busy}>{busy ? 'Activating…' : 'Activate recall'}</button></div>
      </div>
    </div></div>}
  </Layout>;
}
