import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ClipboardCopy, ShieldCheck, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { AccessApplication, accessApplications, invitations } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';

export default function AccessApplicationsPage() {
  const { user } = useAuthCtx();
  const { toast } = useToast();
  const allowed = Boolean(user?.permissions.includes('*'));
  const [rows, setRows] = useState<AccessApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending_review');
  const [selected, setSelected] = useState<AccessApplication | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  const load = () => accessApplications.list().then(setRows).catch((err) => setError(err.message || 'Could not load applications')).finally(() => setLoading(false));
  useEffect(() => { if (allowed) void load(); }, [allowed]);
  const visible = useMemo(() => status === 'all' ? rows : rows.filter((row) => row.status === status), [rows, status]);
  if (!allowed) return <Navigate to="/home" replace />;

  const decide = async (decision: 'approve' | 'reject') => {
    if (!selected) return;
    if (decision === 'reject' && !reason.trim()) { setError('Record a reason before rejecting an organization.'); return; }
    setBusy(true); setError(''); setInviteUrl('');
    try {
      if (decision === 'approve') {
        const result = await accessApplications.approve(selected.id, reason.trim() || undefined);
        setInviteUrl(result.inviteUrl || '');
        toast(result.emailDelivery === 'failed' ? 'error' : 'success', result.emailDelivery === 'sent' ? 'Organization approved; invitation submitted to email provider' : result.emailDelivery === 'failed' ? 'Organization approved, but email submission failed. Use Resend admin invitation.' : 'Organization approved; email is disabled in this demo');
      } else {
        await accessApplications.reject(selected.id, reason.trim());
      }
      setSelected(null); setReason('');
      if (decision === 'reject') toast('success', 'Access application rejected');
      await load();
    } catch (err: any) { setError(err.message || `Could not ${decision} the application`); }
    finally { setBusy(false); }
  };

  return <Layout currentPage="access-applications" actions={<select aria-label="Filter applications" className="form-select min-w-44" value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending_review">Awaiting review</option><option value="pending_email_verification">Email not verified</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All applications</option></select>}>
    <section className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.09),rgba(255,255,255,.02))] p-5 sm:p-6"><div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-400/10 text-brand-400"><ShieldCheck size={20} /></span><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Platform administration</div><h2 className="mt-1 text-2xl font-bold">Organization access review</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-text-muted">Email verification proves control of an address, not the legitimacy of an organization. Review the submitted identity independently before creating the first administrator invitation.</p></div></div></section>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-300">{error}</div>}
    {inviteUrl && <div className="mt-4 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-4"><div className="text-xs font-bold text-brand-300">Demo invitation created</div><p className="mt-1 text-[10px] text-text-muted">Use this local link for testing. Check the email submission result before assuming a message was sent. The link is exposed here only when the API is running in demo/test mode.</p><div className="mt-3 flex gap-2"><input readOnly className="form-input min-w-0 flex-1" value={inviteUrl} /><button className="btn" onClick={() => { void navigator.clipboard.writeText(inviteUrl); toast('success', 'Invitation link copied'); }}><ClipboardCopy size={14} />Copy</button></div></div>}
      <section className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">{loading ? <div className="loading"><div className="spinner" />Loading access applications…</div> : visible.length ? <div className="space-y-3">{visible.map((row) => <article key={row.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-darker p-4 md:flex-row md:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-text-muted"><Building2 size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{row.organizationName}</h3><Status value={row.status} /></div><p className="mt-1 text-[10px] text-text-muted">{row.organizationType} · {row.jurisdiction}{row.legalRegistrationNumber ? ` · ${row.legalRegistrationNumber}` : ''}</p><p className="mt-2 text-xs text-text-secondary">{row.adminName} · {row.adminEmail}</p><p className="mt-1 text-[9px] text-text-muted">Submitted {formatDate(row.createdAt)}</p></div>{row.status === 'pending_review' ? <button className="btn btn-sm btn-primary" onClick={() => { setSelected(row); setReason(''); setError(''); }}>Review</button> : row.status === 'approved' && row.firstAdminInvitationId ? <button className="btn btn-sm" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await invitations.resend(row.firstAdminInvitationId!); setInviteUrl(result.inviteUrl || ''); toast(result.emailDelivery === 'failed' ? 'error' : 'success', result.emailDelivery === 'sent' ? 'Admin invitation submitted to email provider' : result.emailDelivery === 'failed' ? 'Email submission failed; retry after checking the provider' : 'Email disabled; demo link created'); } catch (err: any) { setError(err.message); } finally { setBusy(false); } }}>Resend admin invitation</button> : <span className="text-[10px] text-text-muted">{row.reviewReason || 'No review note recorded'}</span>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Check size={28} className="mx-auto text-brand-400" /><h3 className="mt-4 text-sm font-semibold">No matching applications</h3><p className="mt-2 text-xs text-text-muted">There are no organization requests in this state.</p></div>}</section>
    {selected && <div className="modal-overlay" onClick={() => !busy && setSelected(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.14em] text-brand-400">Access decision</div><h2 className="mt-1 text-xl font-bold">{selected.organizationName}</h2><p className="mt-2 text-xs text-text-muted">Proposed {selected.organizationType} administrator: {selected.adminName} ({selected.adminEmail})</p></div><button className="btn btn-sm" onClick={() => setSelected(null)} aria-label="Close"><X size={14} /></button></div><label className="mt-5 block"><span className="form-label">Review reason or note</span><textarea className="form-input min-h-28" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for rejection; recommended for approval" /></label><div className="mt-5 grid gap-2 sm:grid-cols-2"><button disabled={busy} className="btn justify-center border-red-400/30 text-red-300" onClick={() => decide('reject')}><X size={14} />Reject</button><button disabled={busy} className="btn btn-primary justify-center" onClick={() => decide('approve')}><Check size={14} />Approve and invite</button></div></div></div>}
  </Layout>;
}

function Status({ value }: { value: string }) { const style = value === 'approved' ? 'badge-green' : value === 'rejected' ? 'badge-red' : value === 'pending_review' ? 'badge-amber' : 'badge-gray'; return <span className={`badge ${style}`}>{value.split('_').join(' ')}</span>; }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(); }
