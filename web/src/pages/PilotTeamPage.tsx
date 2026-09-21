import { FormEvent, useEffect, useState } from 'react';
import { Check, Clock3, Copy, MailPlus, Users } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { invitations } from '../api';

export default function PilotTeamPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const load = () => invitations.list().then(setRows).catch((err) => setError(err.message));
  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setCreated(null);
    try { const result = await invitations.create({ email }); setCreated(result); setEmail(''); await load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(created.inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return <Layout currentPage="pilot">
    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <div className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.10),rgba(255,255,255,.02))] p-6">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><MailPlus size={19} /></span>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Controlled access</div>
        <h2 className="mt-2 text-2xl font-bold">Invite a real pilot user</h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">Each participant gets an attributable account, the role of your organization and their own onboarding journey. The link expires after seven days and can be used once.</p>
        <form onSubmit={submit} className="mt-6"><label className="text-[10px] font-bold uppercase tracking-[.12em] text-text-muted">Work email</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface-darker px-4 text-sm outline-none focus:border-brand-400/50" placeholder="colleague@company.com" /><button disabled={busy} className="mt-3 min-h-11 w-full rounded-xl bg-brand-400 px-4 text-xs font-bold text-emerald-950 disabled:opacity-50">{busy ? 'Creating invitation…' : 'Create invitation'}</button></form>
        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">{error}</div>}
        {created && <div className="mt-5 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4"><div className="flex items-center gap-2 text-xs font-bold text-brand-300"><Check size={14} /> Invitation ready</div><p className="mt-2 text-[10px] leading-4 text-text-muted">Share this link through your trusted company channel. It is shown only now.</p><div className="mt-3 flex gap-2"><input readOnly value={created.inviteUrl} className="min-w-0 flex-1 rounded-xl border border-border bg-black/15 px-3 text-[10px] text-text-secondary" /><button type="button" onClick={copy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-brand-300" title="Copy invitation link">{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div>}
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Pilot cohort</div><h2 className="mt-1 text-lg font-bold">Invitations</h2></div><span className="badge badge-gray">{rows.length} total</span></div><div className="mt-5 space-y-2">{rows.length ? rows.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-darker p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-text-muted"><Users size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{row.email}</div><div className="mt-1 text-[9px] text-text-muted">{row.organization_name} · {row.role}</div></div><span className={`badge ${row.accepted_at ? 'badge-green' : new Date(row.expires_at) < new Date() ? 'badge-red' : 'badge-gray'}`}>{row.accepted_at ? 'Joined' : new Date(row.expires_at) < new Date() ? 'Expired' : <><Clock3 size={10} /> Pending</>}</span></div>) : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-text-muted">No invitations yet.</div>}</div></div>
    </section>
    <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-[10px] leading-5 text-text-muted">CocoaTrace creates the link but does not email it yet. Share it manually, verify the recipient independently, and never post it in a public channel.</div>
  </Layout>;
}
