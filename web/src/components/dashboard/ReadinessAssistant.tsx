import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { readiness } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { personaFor } from '../../product/personas';

type Advice = {
  score: number;
  scope: string;
  narrative: { mode: 'rules' | 'openai'; text: string };
  recommendations: Array<{ priority: string; title: string; detail: string; action: string; path: string; basedOn: string[] }>;
  disclaimer: string;
};

export default function ReadinessAssistant() {
  const { user, onboarding } = useAuthCtx();
  const navigate = useNavigate();
  const persona = personaFor(user?.orgType);
  const Icon = persona.icon;
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try { setAdvice(await readiness.get()); }
    catch (err: any) { setError(err.message || 'Could not calculate readiness.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);

  const top = advice?.recommendations[0];
  return <section className="mt-5 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
    <div className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.11),rgba(255,255,255,.02))] p-5 sm:p-6">
      <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><Icon size={18} /></span><span className="badge badge-green">Your mission</span></div>
      <div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">{persona.name}</div>
      <h3 className="mt-2 text-xl font-bold">{persona.firstMission}</h3>
      <p className="mt-2 text-xs leading-5 text-text-muted">{persona.missionDetail}</p>
      {onboarding?.primary_goal && <div className="mt-4 rounded-xl bg-black/10 px-3 py-2 text-[10px] text-text-muted">Workspace priority · {persona.goals.find((goal) => goal.key === onboarding.primary_goal)?.label || onboarding.primary_goal}</div>}
      <button onClick={() => navigate(persona.missionPath)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-400 px-4 text-xs font-bold text-emerald-950">Start mission <ArrowRight size={13} /></button>
    </div>

    <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-400/10 text-blue-300"><Bot size={18} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">Readiness assistant</h3>{advice && <span className="badge badge-gray">{advice.narrative.mode === 'openai' ? 'AI summary' : 'Rules mode'}</span>}</div><p className="mt-1 text-[10px] text-text-muted">Grounded in current records · scoped to {advice?.scope || 'your access'}</p></div></div><button onClick={load} disabled={loading} className="rounded-xl border border-border p-2 text-text-muted hover:text-white" aria-label="Refresh readiness"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button></div>
      {loading ? <div className="mt-6 h-24 animate-pulse rounded-2xl bg-white/[.035]" /> : error ? <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-xs text-red-300">{error}</div> : advice && top ? <>
        <p className="mt-5 text-sm leading-6 text-text-secondary">{advice.narrative.text}</p>
        <button onClick={() => navigate(top.path)} className="group mt-5 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-darker p-4 text-left hover:border-brand-400/30"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${top.priority === 'urgent' ? 'bg-amber-300/10 text-amber-300' : 'bg-brand-400/10 text-brand-400'}`}><ShieldCheck size={16} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{top.title}</span><span className="mt-1 block text-[10px] text-text-muted">{top.detail}</span></span><span className="text-[10px] font-semibold text-brand-300">{top.action} →</span></button>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[9px] text-text-muted"><Database size={12} />Evidence fields: {top.basedOn.join(', ')}<span className="mx-1 text-border-strong">•</span>{advice.disclaimer}</div>
      </> : null}
    </div>
  </section>;
}
