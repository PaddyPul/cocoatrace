import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, LockKeyhole, Paperclip, Sparkles } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { sourcing } from '../api';
import { useToast } from '../components/shared/ToastProvider';

const initialBrief = '20 metric tonnes of fully fermented organic cocoa beans from Ghana, crop year 2026. Moisture maximum 7.5%, delivered to Rotterdam by 15 November. Require plot-level origin, valid EU Organic evidence and an EUDR data pack.';

export default function SourcingBriefPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [brief, setBrief] = useState(initialBrief);
  const [structured, setStructured] = useState(true);
  const [quantity, setQuantity] = useState('20000');
  const [delivery, setDelivery] = useState('Rotterdam, Netherlands');
  const [incoterm, setIncoterm] = useState('CIF');
  const [requiredBy, setRequiredBy] = useState('2026-11-15');
  const [deadline, setDeadline] = useState('2026-09-30T17:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requirements = useMemo(() => [
    { title: 'Commodity and quantity', detail: `Cocoa beans · ${Number(quantity || 0).toLocaleString()} kg · Ghana · crop year 2026`, ok: true },
    { title: 'Quality specification', detail: 'Fully fermented · moisture ≤ 7.5% · lab evidence before release', ok: true },
    { title: 'Assurance package', detail: 'EU Organic scope · plot geolocation · legality and EUDR data pack', ok: true },
    { title: 'Commercial delivery', detail: `${incoterm} ${delivery} · required ${requiredBy}`, ok: Boolean(delivery && incoterm && requiredBy) },
  ], [quantity, delivery, incoterm, requiredBy]);

  const publish = async () => {
    setBusy(true); setError('');
    try {
      const request = await sourcing.create({ title: 'Organic cocoa for Rotterdam · November 2026', commodity: 'cocoa', quantityKg: Number(quantity), originCountries: ['GH'], qualityRequirements: { fermentation: 'fully fermented', moistureMax: 7.5, cropYear: 2026 }, assuranceRequirements: { euOrganic: true, plotGeolocation: true, eudrDataPack: true }, deliveryLocation: delivery, incoterm, requiredBy, offerDeadline: new Date(deadline).toISOString(), visibility: 'matched', status: 'open' });
      localStorage.setItem('ct_active_sourcing_request', request.id);
      toast('success', 'Sourcing request published to matched verified suppliers.');
      navigate('/marketplace');
    } catch (err: any) { setError(err.message || 'Could not publish sourcing request'); } finally { setBusy(false); }
  };

  return <Layout currentPage="source-new" actions={<button className="btn" onClick={() => navigate('/home?mode=buy')}><ArrowLeft size={14} />Save and close</button>}>
    <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <section><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">Describe the outcome</div><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">What do you need to buy?</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Write the need in ordinary procurement language. CocoaTrace proposes an editable structure—it does not silently invent requirements.</p>
        <div className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-6"><label className="form-label">Sourcing brief</label><textarea className="form-input min-h-36 resize-y leading-6" value={brief} onChange={(event) => setBrief(event.target.value)} /><div className="mt-4 flex flex-wrap gap-2"><button className="btn btn-primary" onClick={() => setStructured(true)}><Sparkles size={15} />Structure requirements</button><button className="btn"><Paperclip size={14} />Attach specification</button></div></div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface-darker p-4 text-xs leading-5 text-text-muted"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-brand-400" />Target price, invited suppliers and internal notes remain private. Only the published requirement is visible to matched suppliers.</div>
      </section>
      <section className="space-y-4"><div className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.1),rgba(255,255,255,.02))] p-5 sm:p-6"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-400 text-emerald-950"><Sparkles size={18} /></span><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">AI-proposed requirements</div><h3 className="mt-1 text-lg font-bold">Review every extracted fact</h3></div></div>{structured && <div className="mt-5 space-y-2">{requirements.map((item) => <div key={item.title} className="flex gap-3 rounded-2xl border border-border bg-surface-darker p-4"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.ok ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}>{item.ok ? <Check size={14} /> : <AlertCircle size={14} />}</span><div><div className="text-xs font-semibold">{item.title}</div><div className="mt-1 text-[11px] leading-5 text-text-muted">{item.detail}</div></div></div>)}</div>}</div>
        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Commercial details</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Quantity (kg)"><input className="form-input" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field><Field label="Incoterm"><select className="form-select" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}><option>CIF</option><option>FOB</option><option>DAP</option></select></Field><Field label="Delivery location"><input className="form-input" value={delivery} onChange={(e) => setDelivery(e.target.value)} /></Field><Field label="Required by"><input className="form-input" type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} /></Field><Field label="Offer deadline"><input className="form-input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field><Field label="Visibility"><select className="form-select"><option>Matched verified suppliers</option><option>Invited suppliers only</option><option>Private draft</option></select></Field></div>{error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300">{error}</div>}<button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={publish} disabled={busy}>{busy ? 'Publishing…' : <>Find matching supply <ArrowRight size={16} /></>}</button></div>
      </section>
    </div>
  </Layout>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="form-label">{label}</span>{children}</label>; }
