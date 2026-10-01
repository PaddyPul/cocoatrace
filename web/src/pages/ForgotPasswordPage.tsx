import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuthPageShell from '../components/auth/AuthPageShell';
import { auth } from '../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await auth.forgotPassword(email.trim().toLowerCase()); setDone(true); }
    catch (err: any) { setError(err.message || 'Could not submit the recovery request'); }
    finally { setBusy(false); }
  };
  return <AuthPageShell eyebrow="Account recovery" title="Reset your password" description="Enter your work email. CocoaTrace returns the same response whether or not an account exists, protecting account privacy.">
    {done ? <div className="rounded-2xl border border-brand-300/20 bg-brand-300/5 p-6 text-center"><CheckCircle2 size={36} className="mx-auto text-brand-300" /><h2 className="mt-4 text-lg font-bold">Check your email</h2><p className="mt-2 text-xs leading-5 text-white/45">If an active account exists and email submission succeeds, you will receive a single-use reset link. Check your inbox and spam folder. Local testing requires the email test inbox.</p><Link to="/login" className="mt-5 inline-block text-xs font-semibold text-brand-300">Return to sign in</Link></div> : <form onSubmit={submit} className="space-y-4"><label><span className="form-label">Work email</span><input required type="email" autoComplete="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}<button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 text-sm font-bold text-emerald-950 disabled:opacity-50">{busy ? 'Submitting…' : <>Send reset instructions <ArrowRight size={15} /></>}</button><p className="text-center text-xs text-white/40"><Link to="/login" className="font-semibold text-brand-300">Back to sign in</Link></p></form>}
  </AuthPageShell>;
}

