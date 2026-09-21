import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, GitBranch,
  MapPin, PackageCheck, Play, QrCode, ShieldCheck, Sparkles,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { traceability } from '../api';
import { MaterialLot, RecallImpactResult } from '../types';

const CLEAR_PROFILE = '/p/asante-cocoa-2024-0847';
const WARNING_PROFILE = '/p/mensah-cocoa-2024-0831';
const DEMO_SUSPECT_KG = 500;

export default function InvestorDemoPage() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [impact, setImpact] = useState<RecallImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    traceability.listLots()
      .then(setLots)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const suspectLot = useMemo(
    () => lots.find((lot) => lot.lotCode === 'GH-2024-0831') || lots.find((lot) => lot.lotType === 'source'),
    [lots],
  );

  const runSimulation = async () => {
    if (!suspectLot) return;
    setRunning(true);
    setError('');
    try {
      setImpact(await traceability.traceForward(suspectLot.id, Math.min(DEMO_SUSPECT_KG, suspectLot.quantityKg)));
    } catch (err: any) {
      setError(err.message || 'The live recall calculation could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Layout currentPage="demo">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(109,190,90,.18),transparent_38%),linear-gradient(135deg,#173326,#0e1c15)] p-6 shadow-2xl shadow-black/15 sm:p-9">
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-emerald-200">
            <Sparkles size={13} /> Investor demo · Ghana to Netherlands
          </div>
          <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-[-.035em] text-white sm:text-5xl">One scan tells the product story. One trace contains the risk.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/65 sm:text-base">CocoaTrace gives every physical lot a live identity—from farm evidence to finished-product safety—then calculates exactly where affected material went.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300" href={CLEAR_PROFILE} target="_blank" rel="noreferrer"><QrCode size={17} /> Open a product profile <ExternalLink size={14} /></a>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-5 text-sm font-semibold text-white transition hover:bg-white/10" onClick={() => document.getElementById('recall-demo')?.scrollIntoView({ behavior: 'smooth' })}><Play size={16} /> Run recall simulation</button>
          </div>
        </div>
      </section>

      <section className="py-7 sm:py-9">
        <div className="mb-5 flex items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">The complete story</div><h3 className="mt-1 text-xl font-bold sm:text-2xl">Three moments investors need to see</h3></div><span className="hidden text-xs text-text-muted sm:block">Live seeded data · No slideware</span></div>
        <div className="grid gap-3 lg:grid-cols-3">
          <StoryCard number="01" icon={QrCode} title="Scan" copy="A permanent QR opens a mobile product page—no account or app required." proof="Public profile + live safety status" />
          <StoryCard number="02" icon={ShieldCheck} title="Verify" copy="Origin, certification, custody, shipment and evidence appear as one readable journey." proof="Claims linked to authenticated records" />
          <StoryCard number="03" icon={GitBranch} title="Respond" copy="Trace backward to sources or forward to every finished lot and recipient." proof="Quantity-aware recall scope" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Product identities</div><h3 className="mt-1 text-lg font-bold">See the QR experience</h3></div><QrCode className="text-brand-400" /></div>
          <p className="mt-2 text-xs leading-5 text-text-secondary">The same product page can move from clear to warning as the underlying safety record changes.</p>
          <div className="mt-5 space-y-3">
            <ProfileLink href={CLEAR_PROFILE} status="Clear" title="Asante Cocoa · 2024 Harvest" lot="GH-2024-0847" tone="green" />
            <ProfileLink href={WARNING_PROFILE} status="Demo warning" title="Mensah Cocoa · 2024 Harvest" lot="GH-2024-0831" tone="amber" />
          </div>
          <div className="mt-5 rounded-2xl bg-surface-darker p-4 text-xs leading-5 text-text-secondary"><strong className="text-text-primary">What this proves:</strong> the QR is a durable pointer, not a static label. Provenance and safety can update without reprinting packaging.</div>
        </div>

        <div id="recall-demo" className="scroll-mt-6 rounded-3xl border border-amber-300/20 bg-[linear-gradient(145deg,rgba(120,76,20,.18),rgba(24,37,30,1)_52%)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-300">Live recall calculation</div><h3 className="mt-1 text-lg font-bold">What if 500 kg is suspect?</h3><p className="mt-2 max-w-xl text-xs leading-5 text-text-secondary">Start with source lot GH-2024-0831. CocoaTrace follows declared allocations through blending and packaging, without changing any records.</p></div><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold text-amber-200">Safe simulation</span></div>

          {!impact ? (
            <div className="mt-6 rounded-2xl border border-dashed border-amber-200/20 bg-black/10 p-5 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><GitBranch size={20} /></div>
              <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-text-secondary">Run the server-side calculation to reveal impacted lots, full commingled recall quantity and downstream recipients.</p>
              <button className="btn btn-primary mt-4 justify-center" disabled={loading || running || !suspectLot} onClick={runSimulation}>{running ? 'Calculating…' : <><Play size={14} /> Run live calculation</>}</button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Suspect input" value={`${DEMO_SUSPECT_KG} kg`} />
                <Metric label="Impacted lots" value={impact.totals.impactedLotCount.toString()} />
                <Metric label="Finished recall" value={`${impact.totals.leafRecallQuantityKg.toLocaleString()} kg`} highlight />
                <Metric label="Recipients" value={impact.totals.recipientCount.toString()} />
              </div>
              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-black/10 p-4">
                <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" /><div><div className="text-sm font-semibold text-white">Precise contamination mass, conservative recall scope</div><p className="mt-1 text-xs leading-5 text-text-secondary">CocoaTrace keeps the suspect-equivalent quantity precise, but recalls each commingled finished lot in full. That distinction prevents both false precision and double-counting.</p></div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><span className={`badge ${impact.exactness === 'declared' ? 'badge-green' : 'badge-amber'}`}>{impact.exactness} allocations</span><span className="badge badge-gray">{impact.impactedDistributions.length} distributions found</span></div>
              <button className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-brand-300 hover:text-brand-200" onClick={() => navigate('/recalls')}>Open the full investigation workspace <ArrowRight size={14} /></button>
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs text-red-300">{error}</div>}
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">The commercial wedge</div><h3 className="mt-1 text-xl font-bold">A buyer-ready traceability file, not another supply-chain database.</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">Start with one exporter, one EU buyer and one certifier. Digitize one shipment, publish its product identity, and prove recall readiness before expanding the workflow.</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><Pill icon={MapPin} text="Verified origin" /><Pill icon={PackageCheck} text="Chain of custody" /><Pill icon={CheckCircle2} text="Recall ready" /></div></div>
      </section>
    </Layout>
  );
}

function StoryCard({ number, icon: Icon, title, copy, proof }: { number: string; icon: typeof QrCode; title: string; copy: string; proof: string }) {
  return <article className="rounded-3xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand-400/30"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><Icon size={19} /></span><span className="font-mono text-[10px] text-text-muted">{number}</span></div><h4 className="mt-5 text-lg font-bold">{title}</h4><p className="mt-2 text-xs leading-5 text-text-secondary">{copy}</p><div className="mt-4 border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-[.1em] text-brand-300">{proof}</div></article>;
}

function ProfileLink({ href, status, title, lot, tone }: { href: string; status: string; title: string; lot: string; tone: 'green' | 'amber' }) {
  return <a href={href} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-2xl border border-border bg-surface-darker p-4 transition hover:border-brand-400/30"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone === 'green' ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}><QrCode size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text-primary">{title}</span><span className="mt-1 block font-mono text-[10px] text-text-muted">LOT {lot}</span></span><span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-semibold sm:block ${tone === 'green' ? 'bg-brand-400/10 text-brand-300' : 'bg-amber-300/10 text-amber-200'}`}>{status}</span><ExternalLink size={14} className="text-text-muted transition group-hover:text-brand-300" /></a>;
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${highlight ? 'border-amber-300/25 bg-amber-300/10' : 'border-border bg-black/10'}`}><div className="text-[9px] font-bold uppercase tracking-[.12em] text-text-muted">{label}</div><div className={`mt-2 font-mono text-lg font-bold ${highlight ? 'text-amber-200' : 'text-white'}`}>{value}</div></div>;
}

function Pill({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-darker px-3 py-2 text-[11px] text-text-secondary"><Icon size={13} className="text-brand-400" />{text}</span>;
}
