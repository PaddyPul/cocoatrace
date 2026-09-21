import { useState } from 'react';
import { CheckCircle2, MessageSquareText, Send, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { workspace } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';

const TASKS: Record<string, string> = {
  dashboard: 'Understand what needs attention',
  products: 'Review a product passport',
  recalls: 'Trace or respond to a recall',
  farms: 'Capture or verify an origin',
  batches: 'Prepare a traceable batch',
  evidence: 'Attach evidence to a claim',
  shipments: 'Track a shipment milestone',
};

export default function PilotFeedback({ currentPage }: { currentPage: string }) {
  const { onboarding } = useAuthCtx();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!onboarding?.pilot_mode) return null;

  const close = () => { setOpen(false); setSent(false); setError(''); };
  const submit = async () => {
    if (!rating || comment.trim().length < 3) { setError('Choose a rating and add a short note.'); return; }
    setBusy(true); setError('');
    try {
      await workspace.sendFeedback({
        page: location.pathname,
        task: TASKS[currentPage] || `Use ${currentPage}`,
        rating,
        comment: comment.trim(),
      });
      setSent(true); setRating(0); setComment('');
    } catch (err: any) { setError(err.message || 'Could not send feedback.'); }
    finally { setBusy(false); }
  };

  return <>
    <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-300/25 bg-[#183526] px-4 text-xs font-bold text-white shadow-2xl shadow-black/40 transition hover:-translate-y-0.5 hover:bg-[#21452f]">
      <MessageSquareText size={16} className="text-brand-300" /> Pilot feedback
    </button>
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface-dark p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="feedback-title">
        <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Design-partner pilot</div><h2 id="feedback-title" className="mt-1 text-xl font-bold">Was this task clear?</h2><p className="mt-2 text-xs leading-5 text-text-muted">{TASKS[currentPage] || `Use ${currentPage}`}</p></div><button onClick={close} className="rounded-xl p-2 text-text-muted hover:bg-white/5 hover:text-white" aria-label="Close feedback"><X size={17} /></button></div>
        {sent ? <div className="mt-7 rounded-2xl border border-brand-400/20 bg-brand-400/10 p-5 text-center"><CheckCircle2 size={28} className="mx-auto text-brand-400" /><div className="mt-3 text-sm font-bold">Feedback received</div><p className="mt-1 text-xs text-text-muted">Thank you. This is stored separately from provenance records.</p><button onClick={close} className="mt-5 min-h-10 rounded-xl bg-brand-400 px-5 text-xs font-bold text-emerald-950">Done</button></div> : <>
          <div className="mt-6 grid grid-cols-5 gap-2" aria-label="Task clarity rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setRating(value)} className={`min-h-11 rounded-xl border text-sm font-bold transition ${rating === value ? 'border-brand-300 bg-brand-300 text-emerald-950' : 'border-border bg-surface text-text-secondary hover:border-brand-300/40'}`} aria-label={`${value} out of 5`}>{value}</button>)}</div>
          <div className="mt-2 flex justify-between text-[9px] text-text-muted"><span>Confusing</span><span>Effortless</span></div>
          <label className="mt-5 block text-[10px] font-bold uppercase tracking-[.12em] text-text-muted">What should we change?</label>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface p-3 text-sm text-white outline-none placeholder:text-text-muted focus:border-brand-400/50" placeholder="Tell us where you paused, what you expected, or what was missing…" />
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          <button onClick={submit} disabled={busy} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-4 text-xs font-bold text-emerald-950 disabled:opacity-50"><Send size={14} />{busy ? 'Sending…' : 'Send feedback'}</button>
          <p className="mt-3 text-center text-[9px] leading-4 text-text-muted">No hidden session recording or visitor fingerprinting.</p>
        </>}
      </section>
    </div>}
  </>;
}
