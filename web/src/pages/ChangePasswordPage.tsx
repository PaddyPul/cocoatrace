import { FormEvent, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { passwordPolicyError } from '../components/auth/passwordPolicy';
import { auth } from '../api';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setDone(false);
    const policyError = passwordPolicyError(newPassword);
    if (policyError) { setError(policyError); return; }
    if (newPassword !== confirm) { setError('The new passwords do not match.'); return; }
    if (currentPassword === newPassword) { setError('Choose a password different from the current password.'); return; }
    setBusy(true);
    try { await auth.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirm(''); setDone(true); }
    catch (err: any) { setError(err.message || 'Could not change the password'); }
    finally { setBusy(false); }
  };
  return <Layout currentPage="account-security"><section className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-5 sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><KeyRound size={20} /></span><a href="/account/passkeys" className="btn btn-secondary mt-5">Manage passkeys</a><h2 className="mt-5 text-2xl font-bold">Change your password</h2><p className="mt-2 text-sm leading-6 text-text-muted">Confirm your current password before choosing a replacement. Other active sessions are revoked after this sensitive change.</p><form onSubmit={submit} className="mt-6 space-y-4"><label><span className="form-label">Current password</span><input required type="password" autoComplete="current-password" className="form-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span className="form-label">New password</span><input required type="password" autoComplete="new-password" className="form-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span className="form-label">Confirm new password</span><input required type="password" autoComplete="new-password" className="form-input" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><p className="text-[10px] leading-5 text-text-muted">Use 12 or more characters with upper and lowercase letters and a number.</p>{error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-300">{error}</div>}{done && <div className="flex items-center gap-2 rounded-xl border border-brand-400/25 bg-brand-400/5 p-3 text-xs text-brand-300"><CheckCircle2 size={15} />Password changed. Other sessions have been revoked.</div>}<button disabled={busy} className="min-h-11 rounded-xl bg-brand-400 px-5 text-xs font-bold text-emerald-950 disabled:opacity-50">{busy ? 'Updating…' : 'Change password'}</button></form></section></Layout>;
}

