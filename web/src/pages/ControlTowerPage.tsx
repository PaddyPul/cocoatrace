import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Boxes, CheckCircle2, CircleDot, FileCheck2,
  GitBranch, Globe2, MapPin, PackageCheck, QrCode, ShieldCheck, Ship, Sparkles,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { batches, evidence, productProfiles, recalls, shipments, traceability } from '../api';
import { Batch, Evidence, MaterialLot, ProductProfileSummary, RecallNotice, Shipment } from '../types';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { SkeletonDetail } from '../components/shared/Skeleton';
import ReadinessAssistant from '../components/dashboard/ReadinessAssistant';

type TowerData = {
  batches: Batch[];
  products: ProductProfileSummary[];
  lots: MaterialLot[];
  recalls: RecallNotice[];
  shipments: Shipment[];
  evidence: Evidence[];
};

const emptyData: TowerData = { batches: [], products: [], lots: [], recalls: [], shipments: [], evidence: [] };

export default function ControlTowerPage() {
  const { user, canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [data, setData] = useState<TowerData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [batchRows, products, lots, recallRows, shipmentRows, evidenceRows] = await Promise.all([
          canDo('batch.read') || canDo('batch.create') || canDo('batch.attest') ? batches.list() : Promise.resolve([]),
          canDo('batch.read') ? productProfiles.list() : Promise.resolve([]),
          canDo('batch.read') ? traceability.listLots() : Promise.resolve([]),
          canDo('recall.manage') ? recalls.list() : Promise.resolve([]),
          canDo('shipment.read') || canDo('shipment.request') || canDo('shipment.update') || canDo('shipment.accept') ? shipments.list() : Promise.resolve([]),
          canDo('evidence.read') || canDo('evidence.upload') ? evidence.list() : Promise.resolve([]),
        ]);
        setData({ batches: batchRows, products, lots, recalls: recallRows, shipments: shipmentRows, evidence: evidenceRows });
      } catch (err: any) {
        setError(err.message || 'Could not load the control tower.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const metrics = useMemo(() => {
    const attested = data.batches.filter((batch) => batch.organic_claim_status === 'attested').length;
    const published = data.products.filter((product) => product.visibility === 'published').length;
    const unsafe = data.products.filter((product) => product.safety_status !== 'clear').length;
    const sourceVolume = data.lots.filter((lot) => lot.lotType === 'source').reduce((sum, lot) => sum + Number(lot.quantityKg), 0);
    const dimensions = [
      data.batches.length ? attested / data.batches.length : null,
      data.products.length ? published / data.products.length : null,
      data.products.length ? data.products.filter((product) => Number(product.evidence_count) > 0).length / data.products.length : null,
    ].filter((value): value is number => value !== null);
    const readiness = dimensions.length ? Math.round(dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length * 100) : 0;
    return { attested, published, unsafe, sourceVolume, readiness };
  }, [data]);

  const priorities = useMemo(() => {
    const rows: Array<{ tone: 'amber' | 'green' | 'blue'; title: string; copy: string; action: string; path: string }> = [];
    const activeRecalls = data.recalls.filter((item) => item.status === 'active');
    const unattested = data.batches.filter((item) => item.organic_claim_status === 'pending_attestation');
    const draftProducts = data.products.filter((item) => item.visibility !== 'published');
    if (activeRecalls.length) rows.push({ tone: 'amber', title: `${activeRecalls.length} active safety notice${activeRecalls.length === 1 ? '' : 's'}`, copy: 'Review impacted lots, recipients and public instructions.', action: 'Open incident', path: '/recalls' });
    if (unattested.length) rows.push({ tone: 'blue', title: `${unattested.length} batch${unattested.length === 1 ? '' : 'es'} awaiting verification`, copy: 'Certification is blocking buyer-ready provenance.', action: 'Review batches', path: '/batches' });
    if (draftProducts.length) rows.push({ tone: 'blue', title: `${draftProducts.length} product passport${draftProducts.length === 1 ? '' : 's'} not live`, copy: 'Publish the identity buyers will scan and verify.', action: 'View products', path: '/products' });
    if (!rows.length) rows.push({ tone: 'green', title: 'Network is operating normally', copy: 'No urgent traceability or safety exceptions require attention.', action: 'Review products', path: '/products' });
    return rows.slice(0, 3);
  }, [data]);

  if (loading) return <Layout currentPage="dashboard"><SkeletonDetail /></Layout>;

  return <Layout currentPage="dashboard">
    {error && <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-400">{error}</div>}
    <section className="relative overflow-hidden rounded-3xl border border-brand-400/20 bg-[radial-gradient(circle_at_85%_15%,rgba(109,190,90,.2),transparent_32%),linear-gradient(135deg,#173326,#0e1a14)] p-6 shadow-2xl shadow-black/15 sm:p-8">
      <div className="relative grid gap-7 xl:grid-cols-[1fr_auto] xl:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-brand-300"><CircleDot size={12} /> Live network control tower</div><h2 className="max-w-3xl text-3xl font-bold leading-tight tracking-[-.035em] sm:text-4xl">Good {dayPart()}, {user?.name?.split(' ')[0]}. Your corridor is {metrics.readiness}% ready.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/60">See product readiness, evidence gaps and safety risk across the Ghana → Netherlands network—then act on the exceptions.</p></div>
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.05] p-4 backdrop-blur"><ReadinessRing value={metrics.readiness} /><div><div className="text-sm font-bold text-white">Network readiness</div><div className="mt-1 text-[10px] leading-4 text-white/45">Verification · publishing · evidence</div></div></div>
      </div>
    </section>

    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi icon={QrCode} label="Live products" value={metrics.published.toLocaleString()} note={`${data.products.length} identities`} />
      <Kpi icon={Boxes} label="Traceable source" value={`${compactKg(metrics.sourceVolume)} kg`} note={`${data.lots.length} connected lots`} />
      <Kpi icon={FileCheck2} label="Approved evidence" value={data.evidence.length.toLocaleString()} note="claims with receipts" />
      <Kpi icon={ShieldCheck} label="Products at risk" value={metrics.unsafe.toLocaleString()} note={metrics.unsafe ? 'action required' : 'no active warnings'} warn={metrics.unsafe > 0} />
    </section>

    <ReadinessAssistant />

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Exception inbox</div><h3 className="mt-1 text-lg font-bold">What needs attention</h3></div><span className="badge badge-gray">{priorities.length} priorities</span></div>
        <div className="mt-5 space-y-2">{priorities.map((item) => <button key={item.title} onClick={() => navigate(item.path)} className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface-darker p-4 text-left transition hover:border-brand-400/30"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${item.tone === 'amber' ? 'bg-amber-300/10 text-amber-300' : item.tone === 'green' ? 'bg-brand-400/10 text-brand-400' : 'bg-blue-400/10 text-blue-300'}`}>{item.tone === 'amber' ? <AlertTriangle size={18} /> : item.tone === 'green' ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-text-muted">{item.copy}</span></span><span className="hidden items-center gap-1 text-[10px] font-semibold text-brand-300 group-hover:flex">{item.action}<ArrowRight size={12} /></span></button>)}</div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Corridor pulse</div><h3 className="mt-1 text-lg font-bold">From origin to market</h3>
        <div className="mt-6 space-y-1"><FlowStep icon={MapPin} title="Origin captured" value={`${data.batches.length} batches`} done={data.batches.length > 0} /><FlowLine /><FlowStep icon={ShieldCheck} title="Verified" value={`${metrics.attested} attested`} done={metrics.attested > 0} /><FlowLine /><FlowStep icon={QrCode} title="Products live" value={`${metrics.published} passports`} done={metrics.published > 0} /><FlowLine /><FlowStep icon={Ship} title="Moving to market" value={`${data.shipments.length} shipments`} done={data.shipments.length > 0} /></div>
      </div>
    </section>

    <section className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Core workflows</div><h3 className="mt-1 text-lg font-bold">Move from signal to action</h3></div><button className="text-xs font-semibold text-brand-300 hover:text-brand-200" onClick={() => navigate('/demo')}>Open guided story →</button></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3"><ActionCard icon={QrCode} title="Manage product identities" copy="Review public passports, evidence coverage and safety state." action="Open products" onClick={() => navigate('/products')} /><ActionCard icon={GitBranch} title="Investigate genealogy" copy="Trace material backward to origin or forward to every recipient." action="Start a trace" onClick={() => navigate('/recalls')} /><ActionCard icon={PackageCheck} title="Prepare buyer assurance" copy="Resolve verification gaps before a lot enters the market." action="Review batches" onClick={() => navigate('/batches')} /></div>
    </section>

    <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-[linear-gradient(110deg,rgba(109,190,90,.08),transparent)] p-5 sm:p-6"><div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><Globe2 size={20} /></span><div><div className="text-sm font-bold">One shared truth across every organization</div><div className="mt-1 text-xs text-text-muted">Designed for GS1-compatible event exchange and interoperable national traceability—not a closed ledger.</div></div></div><span className="badge badge-green">Ghana → EU corridor</span></section>
  </Layout>;
}

function dayPart() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
function compactKg(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value.toLocaleString(); }

function ReadinessRing({ value }: { value: number }) {
  return <div className="relative grid h-14 w-14 place-items-center rounded-full" style={{ background: `conic-gradient(#7dcc61 ${value * 3.6}deg, rgba(255,255,255,.1) 0)` }}><div className="grid h-11 w-11 place-items-center rounded-full bg-[#14241b] font-mono text-sm font-bold text-white">{value}%</div></div>;
}
function Kpi({ icon: Icon, label, value, note, warn = false }: { icon: typeof QrCode; label: string; value: string; note: string; warn?: boolean }) { return <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">{label}</span><Icon size={15} className={warn ? 'text-amber-300' : 'text-brand-400'} /></div><div className={`mt-4 font-mono text-2xl font-bold sm:text-3xl ${warn ? 'text-amber-200' : ''}`}>{value}</div><div className="mt-2 text-[10px] text-text-muted">{note}</div></div>; }
function FlowStep({ icon: Icon, title, value, done }: { icon: typeof MapPin; title: string; value: string; done: boolean }) { return <div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${done ? 'bg-brand-400/10 text-brand-400' : 'bg-white/5 text-text-muted'}`}><Icon size={17} /></span><div className="flex-1"><div className="text-xs font-semibold">{title}</div><div className="mt-0.5 text-[10px] text-text-muted">{value}</div></div>{done && <CheckCircle2 size={15} className="text-brand-400" />}</div>; }
function FlowLine() { return <div className="ml-5 h-4 w-px bg-border-strong" />; }
function ActionCard({ icon: Icon, title, copy, action, onClick }: { icon: typeof QrCode; title: string; copy: string; action: string; onClick: () => void }) { return <button onClick={onClick} className="group rounded-2xl border border-border bg-surface-darker p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-400/30"><Icon size={20} className="text-brand-400" /><div className="mt-4 text-sm font-bold">{title}</div><p className="mt-2 text-xs leading-5 text-text-muted">{copy}</p><span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-300">{action}<ArrowRight size={11} className="transition group-hover:translate-x-0.5" /></span></button>; }
