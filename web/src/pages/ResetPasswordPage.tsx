import { FormEvent, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AuthPageShell from '../components/auth/AuthPageShell';
import { passwordPolicyError } from '../components/auth/passwordPolicy';
import { auth } from '../api';

export default function ResetPasswordPage() {
  const { token: pathToken } = useParams();
  const [params] = useSearchParams();
  const token = pathToken || params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'The reset link is incomplete.');
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const policyError = passwordPolicyError(password);
    if (policyError) { setError(policyError); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    if (!token) { setError('The reset link is incomplete.'); return; }
    setBusy(true);
    try { await auth.resetPassword(token, password); setDone(true); setPassword(''); setConfirm(''); }
    catch (err: any) { setError(err.message || 'This reset link is invalid, expired or already used.'); }
    finally { setBusy(false); }
  };
  return <AuthPageShell eyebrow="Account recovery" title={done ? 'Password updated' : 'Choose a new password'} description="Reset links are single-use. A successful reset invalidates existing account sessions so the new password becomes authoritative.">
    {done ? <div className="rounded-2xl border border-brand-300/20 bg-brand-300/5 p-6 text-center"><CheckCircle2 size={36} className="mx-auto text-brand-300" /><p className="mt-4 text-sm font-semibold">Your password has been changed securely.</p><Link to="/login" className="mt-5 inline-block text-xs font-semibold text-brand-300">Continue to sign in</Link></div> : <form onSubmit={submit} className="space-y-4"><label><span className="form-label">New password</span><input required type="password" autoComplete="new-password" className="form-input" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span className="form-label">Confirm new password</span><input required type="password" autoComplete="new-password" className="form-input" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><p className="text-[10px] leading-5 text-white/35">Use 12 or more characters with upper and lowercase letters and a number.</p>{error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}<button disabled={busy || !token} className="min-h-12 w-full rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950 disabled:opacity-50">{busy ? 'Updating…' : 'Set new password'}</button><p className="text-center text-xs text-white/40"><Link to="/forgot-password" className="font-semibold text-brand-300">Request another reset link</Link></p></form>}
  </AuthPageShell>;
}

