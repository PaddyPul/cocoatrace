import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, FileCheck2, Handshake, PackageCheck, Search, ShieldCheck, Sparkles, Sprout, TriangleAlert } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { contracts, holdings, listings, offers, sourcing } from '../api';
import { Contract, Holding, Listing, Offer, SourcingRequest } from '../types';
import { useAuthCtx } from '../components/auth/AuthProvider';

type Mode = 'buy' | 'sell';
type HomeData = { listings: Listing[]; requests: SourcingRequest[]; offers: Offer[]; contracts: Contract[]; holdings: Holding[] };
const empty: HomeData = { listings: [], requests: [], offers: [], contracts: [], holdings: [] };

export default function ExperienceHomePage() {
  const { user, canDo, onboarding } = useAuthCtx();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const defaultMode: Mode = onboarding?.primary_goal?.startsWith('buy') || user?.orgType === 'importer' ? 'buy' : 'sell';
  const mode = (params.get('mode') === 'sell' ? 'sell' : params.get('mode') === 'buy' ? 'buy' : (localStorage.getItem('ct_experience_mode') as Mode)) || defaultMode;
  const [data, setData] = useState<HomeData>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('ct_experience_mode', mode);
    const safe = <T,>(allowed: boolean, call: () => Promise<T[]>) => allowed ? call().catch(() => []) : Promise.resolve([] as T[]);
    Promise.all([
      safe(canDo('listing.read'), listings.list),
      sourcing.list().catch(() => []),
      safe(canDo('offer.respond') || canDo('offer.create'), offers.list),
      safe(canDo('contract.read'), contracts.list),
      safe(canDo('holding.read') || canDo('holding.create'), holdings.list),
    ]).then(([listingRows, requestRows, offerRows, contractRows, holdingRows]) => setData({ listings: listingRows, requests: requestRows, offers: offerRows, contracts: contractRows, holdings: holdingRows })).finally(() => setLoading(false));
  }, [mode, user?.id]);

  const switchMode = (next: Mode) => { localStorage.setItem('ct_experience_mode', next); setParams({ mode: next }); };
  return <Layout currentPage="home" actions={<div className="hidden rounded-xl border border-border bg-surface-darker p-1 sm:flex"><ModeButton active={mode === 'buy'} onClick={() => switchMode('buy')} icon={Search}>Buy</ModeButton><ModeButton active={mode === 'sell'} onClick={() => switchMode('sell')} icon={Sprout}>Sell</ModeButton></div>}>
    {loading ? <div className="loading"><div className="spinner" />Preparing your workspace…</div> : mode === 'buy' ? <BuyerHome data={data} firstName={user?.name?.split(' ')[0] || 'there'} navigate={navigate} /> : <SellerHome data={data} firstName={user?.name?.split(' ')[0] || 'there'} navigate={navigate} />}
  </Layout>;
}

function BuyerHome({ data, firstName, navigate }: { data: HomeData; firstName: string; navigate: ReturnType<typeof useNavigate> }) {
  const qualified = data.listings.reduce((sum, item) => sum + Number(item.available_quantity_kg || 0), 0);
  const pendingOffers = data.offers.filter((item) => item.status === 'pending').length;
  return <>
    <Hero eyebrow="Verified procurement" title={`Good ${dayPart()}, ${firstName}. Source ingredients with proof already attached.`} copy="Describe what you need once. CocoaTrace matches physical supply, field-level origin, quality evidence and delivery terms—then preserves the trace through fulfilment." action="Create sourcing brief" onClick={() => navigate('/source/new')} />
    <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Qualified supply" value={`${compactKg(qualified)} kg`} note={`${data.listings.length} published lots`} /><Metric label="Open sourcing needs" value={String(data.requests.filter((item) => item.status === 'open').length)} note="matched suppliers can respond" /><Metric label="Offers to decide" value={String(pendingOffers)} note="price and assurance together" /><Metric label="Active orders" value={String(data.contracts.length)} note="commercial + trace record" /></div>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]"><Panel eyebrow="Next decisions" title="Move procurement forward"><Task icon={Search} title="Review verified cocoa supply" copy={`${data.listings.length} lots expose origin, quantity and assurance before contact.`} action="Find supply" onClick={() => navigate('/marketplace')} /><Task icon={FileCheck2} title="Compare shortlisted offers" copy="Normalize commercial terms and evidence gaps side by side." action="Compare" onClick={() => navigate('/source/compare')} /><Task icon={Handshake} title="Continue the active deal" copy={data.contracts.length ? 'Release conditions, shipment and payment milestones stay in one room.' : 'Accepted offers become an attributable shared fulfilment record.'} action="Deal room" onClick={() => navigate(data.contracts[0] ? `/deal-room/${data.contracts[0].id}` : '/contracts')} /></Panel><Copilot title="Two decisions can move today" text="The Asante lot has complete origin and organic evidence. Mensah is cheaper, but its evidence must be checked against the requested delivery date. CocoaTrace shows the trade-off; your team makes the award." /></section>
    <Journey active={1} labels={['Define need', 'Match supply', 'Review proof', 'Contract', 'Receive']} />
  </>;
}

function SellerHome({ data, firstName, navigate }: { data: HomeData; firstName: string; navigate: ReturnType<typeof useNavigate> }) {
  const inventory = data.holdings.filter((item) => item.status === 'available').reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
  const received = data.offers.filter((item) => item.status === 'pending').length;
  return <>
    <Hero eyebrow="Verified market access" title={`Good ${dayPart()}, ${firstName}. Turn traceable inventory into buyer-ready supply.`} copy="Reuse approved farm, certification and quality evidence across eligible lots, respond to matched buyer needs and fulfil accepted orders without rebuilding the dossier." action="Publish verified supply" onClick={() => navigate('/supply/new')} />
    <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Available inventory" value={`${compactKg(inventory)} kg`} note="physical and uncommitted" /><Metric label="Published supply" value={String(data.listings.filter((item) => item.seller_organization_id).length)} note="visible to qualified buyers" /><Metric label="Buyer requests" value={String(data.requests.filter((item) => item.status === 'open').length)} note="open verified demand" /><Metric label="Offers received" value={String(received)} note="awaiting commercial decision" /></div>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]"><Panel eyebrow="Matched opportunities" title="Respond where you already qualify"><Task icon={Building2} title="DutchCacao · organic cocoa" copy="20,000 kg · Ghana origin · Rotterdam · plot proof and EU Organic required." action="Prepare offer" onClick={() => navigate('/supply/new')} /><Task icon={PackageCheck} title="Finish one reusable product dossier" copy="Resolve the plot or evidence gap once, then reuse the approved fact safely." action="Open products" onClick={() => navigate('/products')} /><Task icon={Handshake} title="Manage buyer responses" copy="Review offers and create a contract from an accepted commercial decision." action="Open offers" onClick={() => navigate('/offers')} /></Panel><Copilot title="Best next action" text="Publish GH-2024-0847 as a partial-fill offer. It matches every mandatory assurance requirement and can cover most of the buyer need without mixing in an unverified lot." /></section>
    <Journey active={2} labels={['Capture lot', 'Verify proof', 'Publish supply', 'Fulfil order', 'Build history']} />
  </>;
}

function Hero({ eyebrow, title, copy, action, onClick }: { eyebrow: string; title: string; copy: string; action: string; onClick: () => void }) { return <section className="relative overflow-hidden rounded-3xl border border-brand-400/20 bg-[radial-gradient(circle_at_85%_15%,rgba(109,190,90,.22),transparent_30%),linear-gradient(135deg,#173326,#0e1a14)] p-6 sm:p-8"><div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">{eyebrow}</div><h2 className="mt-3 max-w-4xl text-3xl font-bold leading-tight tracking-[-.04em] sm:text-4xl">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/60">{copy}</p></div><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={onClick}>{action}<ArrowRight size={16} /></button></div></section>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">{label}</div><div className="mt-4 font-mono text-2xl font-bold sm:text-3xl">{value}</div><div className="mt-2 text-[10px] text-text-muted">{note}</div></div>; }
function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">{eyebrow}</div><h3 className="mt-1 text-lg font-bold">{title}</h3><div className="mt-5 space-y-2">{children}</div></div>; }
function Task({ icon: Icon, title, copy, action, onClick }: { icon: typeof Search; title: string; copy: string; action: string; onClick: () => void }) { return <button onClick={onClick} className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface-darker p-4 text-left transition hover:border-brand-400/30"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-text-muted">{copy}</span></span><span className="hidden items-center gap-1 text-[10px] font-semibold text-brand-300 group-hover:flex">{action}<ArrowRight size={12} /></span></button>; }
function Copilot({ title, text }: { title: string; text: string }) { return <div className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.1),rgba(255,255,255,.02))] p-5 sm:p-6"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-400 text-emerald-950"><Sparkles size={18} /></span><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">Grounded workspace copilot</div><h3 className="mt-1 text-lg font-bold">{title}</h3></div></div><p className="mt-5 border-l-2 border-brand-400 pl-4 text-sm leading-6 text-text-secondary">{text}</p><div className="mt-5 flex items-start gap-3 rounded-2xl bg-black/15 p-4 text-xs leading-5 text-text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-400" />Recommendations cite recorded facts. AI cannot approve compliance, award a trade or change the product record.</div></div>; }
function Journey({ active, labels }: { active: number; labels: string[] }) { return <section className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Your end-to-end journey</div><div className="mt-5 grid gap-3 md:grid-cols-5">{labels.map((label, index) => <div key={label} className={`rounded-2xl border p-4 ${index <= active ? 'border-brand-400/30 bg-brand-400/5' : 'border-border bg-surface-darker'}`}><div className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${index < active ? 'bg-brand-400 text-emerald-950' : index === active ? 'border border-brand-400 text-brand-300' : 'bg-white/5 text-text-muted'}`}>{index < active ? <CheckCircle2 size={14} /> : index + 1}</div><div className="mt-3 text-xs font-semibold">{label}</div>{index === active && <div className="mt-2 flex items-center gap-1 text-[9px] text-amber-300"><TriangleAlert size={11} />Current stage</div>}</div>)}</div></section>; }
function ModeButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Search; children: React.ReactNode }) { return <button onClick={onClick} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold ${active ? 'bg-white text-emerald-950' : 'text-text-muted hover:text-white'}`}><Icon size={13} />{children}</button>; }
function compactKg(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 0)}k` : value.toLocaleString(); }
function dayPart() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
