import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Leaf, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { workspace } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { personaFor } from '../product/personas';

export default function OnboardingPage() {
  const { user, onboarding, refreshOnboarding } = useAuthCtx();
  const navigate = useNavigate();
  const persona = useMemo(() => personaFor(user?.orgType), [user?.orgType]);
  const PersonaIcon = persona.icon;
  const [step, setStep] = useState(onboarding?.status === 'completed' ? 0 : onboarding?.current_step || 0);
  const [goal, setGoal] = useState(onboarding?.primary_goal || persona.goals[0].key);
  const [pilotMode, setPilotMode] = useState(onboarding?.pilot_mode ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saveProgress = async (nextStep: number) => {
    setBusy(true); setError('');
    try {
      await workspace.updateOnboarding({ status: 'in_progress', currentStep: nextStep, primaryGoal: goal, pilotMode });
      setStep(nextStep);
      await refreshOnboarding();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true); setError('');
    try {
      await workspace.updateOnboarding({ status: 'completed', currentStep: 4, primaryGoal: goal, pilotMode });
      await refreshOnboarding();
      navigate(persona.missionPath);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#09110d] text-white">
    <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 sm:px-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500"><Leaf size={20} /></span><div><div className="text-sm font-bold">CocoaTrace</div><div className="text-[9px] uppercase tracking-[.16em] text-white/35">Workspace setup</div></div></div><div className="text-[10px] text-white/35">Step {Math.min(step + 1, 4)} of 4</div></header>
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-14">
      <div className="mb-10 flex gap-2">{[0, 1, 2, 3].map((item) => <div key={item} className={`h-1 flex-1 rounded-full ${item <= step ? 'bg-brand-400' : 'bg-white/10'}`} />)}</div>
      {step === 0 && <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><div className="inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-brand-200"><Sparkles size={12} /> Built for your job</div><h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-.04em] sm:text-5xl">Welcome, {user?.name?.split(' ')[0]}.</h1><p className="mt-4 max-w-xl text-base leading-7 text-white/55">CocoaTrace is not one giant workflow for everyone. Your workspace will focus on the decisions and records that {persona.name.toLowerCase()} actually owns.</p><button className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={() => saveProgress(1)} disabled={busy}>Set up my workspace <ArrowRight size={16} /></button></div><PersonaCard persona={persona} /></section>}

      {step === 1 && <section><StepHeading eyebrow="Your outcome" title="What must CocoaTrace help you achieve first?" copy="This sets your first mission and the priorities shown in your workspace." /><div className="mt-7 grid gap-3 md:grid-cols-3">{persona.goals.map((item) => <button key={item.key} onClick={() => setGoal(item.key)} className={`rounded-3xl border p-5 text-left transition ${goal === item.key ? 'border-brand-300 bg-brand-300/10' : 'border-white/10 bg-white/[.03] hover:border-white/25'}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${goal === item.key ? 'bg-brand-300 text-emerald-950' : 'bg-white/5 text-white/45'}`}>{goal === item.key ? <Check size={16} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><div className="mt-5 text-sm font-bold">{item.label}</div><p className="mt-2 text-xs leading-5 text-white/45">{item.detail}</p></button>)}</div><StepButtons back={() => setStep(0)} next={() => saveProgress(2)} busy={busy} /></section>}

      {step === 2 && <section className="mx-auto max-w-3xl"><StepHeading eyebrow="First mission" title={persona.firstMission} copy={persona.missionDetail} /><div className="mt-8 rounded-3xl border border-brand-300/20 bg-[radial-gradient(circle_at_top_right,rgba(109,190,90,.15),transparent_40%),rgba(255,255,255,.035)] p-6 sm:p-8"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-300/10 text-brand-300"><PersonaIcon size={21} /></span><div><div className="text-lg font-bold">A focused workspace, not a training manual</div><p className="mt-2 text-sm leading-6 text-white/50">When setup finishes, CocoaTrace will take you directly to this mission. Each screen will explain what is missing, why it matters and the next safe action.</p></div></div><div className="mt-6 grid gap-2 sm:grid-cols-3">{['Use real records', 'Keep source evidence', 'Ask for feedback'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-black/15 p-3 text-xs text-white/60"><CheckCircle2 size={14} className="text-brand-300" />{item}</div>)}</div></div><StepButtons back={() => setStep(1)} next={() => saveProgress(3)} busy={busy} /></section>}

      {step === 3 && <section className="mx-auto max-w-3xl"><StepHeading eyebrow="Design-partner pilot" title="Help us improve the real workflow" copy="Pilot feedback is explicit and minimal. CocoaTrace does not record hidden clickstreams, device fingerprints or product-page visitor identities." /><label className="mt-8 flex cursor-pointer items-start gap-4 rounded-3xl border border-white/10 bg-white/[.035] p-6"><input type="checkbox" checked={pilotMode} onChange={(event) => setPilotMode(event.target.checked)} className="mt-1 h-4 w-4 accent-[#7dcc61]" /><span><span className="flex items-center gap-2 text-sm font-bold"><MessageSquareText size={17} className="text-brand-300" /> Enable pilot feedback</span><span className="mt-2 block text-xs leading-5 text-white/45">Shows a small feedback control so you can rate a task and explain where the workflow is unclear.</span></span></label><div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-300/5 p-4 text-xs leading-5 text-white/45"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-300" />Your operational records remain governed by normal role permissions. Pilot feedback is stored separately from provenance and compliance evidence.</div><div className="mt-8 flex flex-wrap justify-between gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/60" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button><button className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={finish} disabled={busy}>{busy ? 'Preparing workspace…' : <>Finish and start mission <ArrowRight size={16} /></>}</button></div></section>}
      {error && <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
    </div>
  </main>;
}

function PersonaCard({ persona }: { persona: ReturnType<typeof personaFor> }) { const Icon = persona.icon; return <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300/10 text-brand-300"><Icon size={22} /></span><div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">Your workspace</div><h2 className="mt-2 text-xl font-bold">{persona.name}</h2><p className="mt-3 text-sm leading-6 text-white/50">{persona.promise}</p><div className="mt-6 border-t border-white/10 pt-4"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-white/30">First mission</div><div className="mt-2 text-sm font-semibold">{persona.firstMission}</div></div></div>; }
function StepHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-300">{eyebrow}</div><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{copy}</p></div>; }
function StepButtons({ back, next, busy }: { back: () => void; next: () => void; busy: boolean }) { return <div className="mt-8 flex justify-between gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/60" onClick={back}><ArrowLeft size={14} /> Back</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={next} disabled={busy}>{busy ? 'Saving…' : <>Continue <ArrowRight size={15} /></>}</button></div>; }
