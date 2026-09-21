import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, X } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { batches as batchesApi, recalls as recallsApi } from '../api';
import { Batch, RecallNotice } from '../types';
import { fmtDate, StatusBadge } from '../components/shared/helpers';
import { useToast } from '../components/shared/ToastProvider';

export default function RecallCenterPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<RecallNotice[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [instructions, setInstructions] = useState('Stop distribution and hold the affected lot. Contact the issuing organization for instructions.');
  const [severity, setSeverity] = useState<'advisory' | 'warning' | 'critical'>('warning');
  const [batchIds, setBatchIds] = useState<string[]>([]);

  const refresh = () => Promise.all([recallsApi.list(), batchesApi.list()])
    .then(([recalls, allBatches]) => { setItems(recalls); setBatches(allBatches); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!referenceCode || !title || !reason || !instructions || batchIds.length === 0) {
      setError('Reference, title, reason, instructions and at least one affected batch are required.');
      return;
    }
    setBusy(true); setError('');
    try {
      await recallsApi.create({ referenceCode, title, reason, instructions, severity, batchIds });
      setShowCreate(false); setReferenceCode(''); setTitle(''); setReason(''); setBatchIds([]);
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

  return <Layout currentPage="recalls" actions={<button className="btn btn-sm btn-danger" onClick={() => { setError(''); setShowCreate(true); }}><Plus size={13} /> Activate recall</button>}>
    <div className="mb-5 rounded border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-200">
      <div className="flex items-start gap-3"><AlertTriangle size={18} className="shrink-0 text-yellow-400" /><div><strong className="block text-sm text-yellow-300">Safety notices override product storytelling</strong><p className="mt-1 text-text-secondary">Activating a recall immediately pins the instructions to every published profile for the selected batches. Verify the affected lots and wording before activation.</p></div></div>
    </div>
    {error && !showCreate && <div className="mb-4 rounded-sm border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">{error}</div>}
    {loading ? <div className="loading"><div className="spinner" /><div>Loading recalls…</div></div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><div className="empty-title">No recall notices</div><p>No active or resolved recalls are recorded.</p></div> : <div className="space-y-3">
      {items.map((recall) => <article key={recall.id} className={`rounded border p-5 ${recall.status === 'active' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-surface'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><StatusBadge status={recall.status} /><span className={`badge ${recall.severity === 'critical' ? 'badge-red' : recall.severity === 'warning' ? 'badge-amber' : 'badge-blue'}`}>{recall.severity}</span><span className="font-mono text-[10px] text-text-muted">{recall.reference_code}</span></div><h2 className="mt-3 text-base font-semibold">{recall.title}</h2><p className="mt-1 text-xs text-text-secondary">{recall.reason}</p></div>{recall.status === 'active' && <button className="btn btn-sm" disabled={busy} onClick={() => resolve(recall.id)}><CheckCircle2 size={13} /> Resolve</button>}</div>
        <div className="mt-4 rounded-sm bg-surface-darker p-3 text-xs"><span className="font-semibold">Instructions: </span>{recall.instructions}</div>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-text-muted"><span>{recall.batch_ids.length} affected batch{recall.batch_ids.length === 1 ? '' : 'es'}</span><span>Issued by {recall.issued_by}</span><span>{fmtDate(recall.initiated_at)}</span></div>
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
        <div><div className="form-label">Affected batches *</div><div className="max-h-44 space-y-1 overflow-y-auto rounded-sm border border-border p-2">{batches.map((batch) => <label key={batch.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs hover:bg-brand-500/5"><input type="checkbox" checked={batchIds.includes(batch.id)} onChange={(event) => setBatchIds((ids) => event.target.checked ? [...ids, batch.id] : ids.filter((id) => id !== batch.id))} /><span className="font-mono">{batch.id.slice(0, 8)}</span><span className="text-text-muted">{batch.farm_name} · {Number(batch.quantity_kg).toLocaleString()} kg</span></label>)}</div></div>
        {error && <div className="rounded-sm border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex gap-2 pt-2"><button className="btn flex-1 justify-center" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</button><button className="btn btn-danger flex-1 justify-center" onClick={create} disabled={busy}>{busy ? 'Activating…' : 'Activate recall'}</button></div>
      </div>
    </div></div>}
  </Layout>;
}
