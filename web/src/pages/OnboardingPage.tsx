import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileCheck2, Leaf, MessageSquareText, Search, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { workspace } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';

const OUTCOMES = [
  { key: 'buy_verified', label: 'Buy verified supply', detail: 'Describe a requirement, compare evidence-backed matches and move the best fit into a shared deal room.', icon: Search, path: '/home?mode=buy' },
  { key: 'sell_verified', label: 'Sell verified supply', detail: 'Package traceable inventory with buyer-visible proof, publish once and respond to qualified demand.', icon: ShoppingBag, path: '/home?mode=sell' },
  { key: 'contribute_evidence', label: 'Contribute proof', detail: 'Complete the focused farm, certification or custody task that makes a trade verifiable.', icon: FileCheck2, path: '/evidence' },
] as const;

export default function OnboardingPage() {
  const { user, onboarding, refreshOnboarding } = useAuthCtx();
  const navigate = useNavigate();
  const defaultGoal = user?.permissions.includes('listing.create') ? 'sell_verified' : user?.permissions.includes('offer.create') ? 'buy_verified' : 'contribute_evidence';
  const [step, setStep] = useState(onboarding?.status === 'completed' ? 0 : Math.min(onboarding?.current_step || 0, 3));
  const [goal, setGoal] = useState(onboarding?.primary_goal || defaultGoal);
  const [pilotMode, setPilotMode] = useState(onboarding?.pilot_mode ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const outcome = OUTCOMES.find((item) => item.key === goal) || OUTCOMES[0];

  const saveProgress = async (nextStep: number) => {
    setBusy(true); setError('');
    try { await workspace.updateOnboarding({ status: 'in_progress', currentStep: nextStep, primaryGoal: goal, pilotMode }); setStep(nextStep); await refreshOnboarding(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true); setError('');
    try {
      await workspace.updateOnboarding({ status: 'completed', currentStep: 4, primaryGoal: goal, pilotMode });
      if (goal === 'buy_verified' || goal === 'sell_verified') localStorage.setItem('ct_experience_mode', goal === 'buy_verified' ? 'buy' : 'sell');
      await refreshOnboarding(); navigate(outcome.path);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#09110d] text-white">
    <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 sm:px-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500"><Leaf size={20} /></span><div><div className="text-sm font-bold">CocoaTrace</div><div className="text-[9px] uppercase tracking-[.16em] text-white/35">Verified sourcing network</div></div></div><div className="text-[10px] text-white/35">Step {step + 1} of 4</div></header>
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-14">
      <div className="mb-10 flex gap-2">{[0, 1, 2, 3].map((item) => <div key={item} className={`h-1 flex-1 rounded-full ${item <= step ? 'bg-brand-400' : 'bg-white/10'}`} />)}</div>

      {step === 0 && <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><div className="inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-brand-200"><Sparkles size={12} /> Welcome to the network</div><h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-.04em] sm:text-5xl">Verified sourcing should feel as direct as a conversation.</h1><p className="mt-4 max-w-xl text-base leading-7 text-white/55">CocoaTrace connects buyers and suppliers around the same commercial terms, field-level origin and supporting proof—then keeps that truth intact through shipment, transformation and response.</p><button className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={() => saveProgress(1)} disabled={busy}>Show me how it works <ArrowRight size={16} /></button></div><div className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><div className="text-[10px] font-bold uppercase tracking-[.17em] text-brand-300">One shared truth</div><div className="mt-6 space-y-3">{['Source or publish a real requirement', 'Review proof before making a commitment', 'Carry verified identity through the deal', 'Trace affected material precisely if something changes'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-black/15 p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-300/10 text-xs font-bold text-brand-300">{index + 1}</span><span className="text-sm text-white/70">{item}</span></div>)}</div></div></section>}

      {step === 1 && <section><StepHeading eyebrow="Your first outcome" title={`What do you want to accomplish first, ${user?.name?.split(' ')[0]}?`} copy="This changes your starting workspace, not your access. You can switch between buying and selling at any time." /><div className="mt-7 grid gap-3 md:grid-cols-3">{OUTCOMES.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => setGoal(item.key)} className={`rounded-3xl border p-5 text-left transition ${goal === item.key ? 'border-brand-300 bg-brand-300/10' : 'border-white/10 bg-white/[.03] hover:border-white/25'}`}><span className={`grid h-10 w-10 place-items-center rounded-xl ${goal === item.key ? 'bg-brand-300 text-emerald-950' : 'bg-white/5 text-white/45'}`}>{goal === item.key ? <Check size={17} /> : <Icon size={17} />}</span><div className="mt-5 text-sm font-bold">{item.label}</div><p className="mt-2 text-xs leading-5 text-white/45">{item.detail}</p></button>; })}</div><StepButtons back={() => setStep(0)} next={() => saveProgress(2)} busy={busy} /></section>}

      {step === 2 && <section className="mx-auto max-w-4xl"><StepHeading eyebrow="Your first success" title={outcome.label} copy="You will always see the decision first, the proof behind it second and the next safe action third." /><div className="mt-8 grid gap-3 md:grid-cols-3">{[
        { n: '01', title: goal === 'buy_verified' ? 'State the need' : goal === 'sell_verified' ? 'Choose the lot' : 'Open your task', copy: goal === 'buy_verified' ? 'Use plain language or structured requirements.' : goal === 'sell_verified' ? 'Start from inventory already tied to origin.' : 'Only the evidence relevant to your role is shown.' },
        { n: '02', title: 'Check the proof', copy: 'Claims remain linked to source records, certificates and custody events.' },
        { n: '03', title: goal === 'buy_verified' ? 'Open a deal' : goal === 'sell_verified' ? 'Reach buyers' : 'Complete the handoff', copy: 'Both sides keep the same verified identity as the material moves.' },
      ].map((item) => <div key={item.n} className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><div className="text-[10px] font-bold text-brand-300">{item.n}</div><div className="mt-6 text-base font-bold">{item.title}</div><p className="mt-2 text-xs leading-5 text-white/45">{item.copy}</p></div>)}</div><div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-300/15 bg-brand-300/5 p-4 text-xs leading-5 text-white/55"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-300" /><span><strong className="text-white/80">What “verified” means here:</strong> CocoaTrace shows who supplied each claim, what evidence supports it and whether anything is missing. It never turns an AI suggestion into an approval.</span></div><StepButtons back={() => setStep(1)} next={() => saveProgress(3)} busy={busy} /></section>}

      {step === 3 && <section className="mx-auto max-w-3xl"><StepHeading eyebrow="You are ready" title="Start with a guided, real workflow" copy="Seeded records make the complete experience explorable today. Every action still follows the permissions of your organization." /><label className="mt-8 flex cursor-pointer items-start gap-4 rounded-3xl border border-white/10 bg-white/[.035] p-6"><input type="checkbox" checked={pilotMode} onChange={(event) => setPilotMode(event.target.checked)} className="mt-1 h-4 w-4 accent-[#7dcc61]" /><span><span className="flex items-center gap-2 text-sm font-bold"><MessageSquareText size={17} className="text-brand-300" /> Keep pilot feedback available</span><span className="mt-2 block text-xs leading-5 text-white/45">A small control lets you flag unclear steps. Operational evidence and feedback stay separate.</span></span></label><div className="mt-4 grid gap-2 sm:grid-cols-3">{['Evidence-backed', 'Permission-aware', 'Replay anytime'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-brand-300/5 p-3 text-xs text-white/60"><CheckCircle2 size={14} className="text-brand-300" />{item}</div>)}</div><div className="mt-8 flex flex-wrap justify-between gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/60" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button><button className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={finish} disabled={busy}>{busy ? 'Preparing workspace…' : <>Enter my workspace <ArrowRight size={16} /></>}</button></div></section>}
      {error && <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
    </div>
  </main>;
}

function StepHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">{eyebrow}</div><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{copy}</p></div>; }
function StepButtons({ back, next, busy }: { back: () => void; next: () => void; busy: boolean }) { return <div className="mt-8 flex justify-between gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/60" onClick={back}><ArrowLeft size={14} /> Back</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={next} disabled={busy}>{busy ? 'Saving…' : <>Continue <ArrowRight size={15} /></>}</button></div>; }
