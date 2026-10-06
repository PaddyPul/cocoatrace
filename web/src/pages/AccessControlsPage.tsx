import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { api } from '../api';

type Entry = { id: string; name: string; email?: string; active?: boolean; access_suspended_at: string | null; protected: boolean };
type Result = { rows: Entry[]; next: string | null };
export default function AccessControlsPage() {
  const { user } = useAuthCtx();
  const allowed = Boolean(user?.permissions.includes('*'));
  const [organizations, setOrganizations] = useState<Entry[]>([]);
  const [orgNext, setOrgNext] = useState<string | null>(null);
  const [organization, setOrganization] = useState('');
  const [members, setMembers] = useState<Entry[]>([]);
  const [userNext, setUserNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: 'organizations' | 'users'; row: Entry } | null>(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loadOrganizations = async (after?: string) => {
    const result = await api<Result>('GET', `/admin/access-controls/organizations${after ? `?after=${after}` : ''}`);
    setOrganizations(previous => after ? [...previous, ...result.rows] : result.rows); setOrgNext(result.next);
  };
  const loadMembers = async (id: string, after?: string) => {
    const result = await api<Result>('GET', `/admin/access-controls/users?organizationId=${id}${after ? `&after=${after}` : ''}`);
    setMembers(previous => after ? [...previous, ...result.rows] : result.rows); setUserNext(result.next);
  };
  useEffect(() => { if (allowed) void loadOrganizations().catch(() => setError('Could not load access controls')); }, [allowed]);
  const selectOrganization = async (id: string) => {
    setOrganization(id); setMembers([]); setUserNext(null); setSelected(null); setPassword(''); setReason(''); setError('');
    if (id) { setBusy(true); try { await loadMembers(id); } catch { setError('Could not load members'); } finally { setBusy(false); } }
  };
  const decide = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('POST', `/admin/access-controls/${selected.kind}/${selected.row.id}`, { suspended: !selected.row.access_suspended_at, reason, currentPassword: password });
      setNotice('Access decision recorded. Restoring access requires a fresh sign-in; revoked sessions and invitations stay revoked.');
      setSelected(null); setReason('');
      await loadOrganizations(); if (organization) await loadMembers(organization);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Access decision failed'); }
    finally { setPassword(''); setBusy(false); }
  };
  if (!allowed) return <Navigate to="/home" replace />;
  const choose = (kind: 'organizations' | 'users', row: Entry) => { setSelected({ kind, row }); setReason(''); setPassword(''); setError(''); setNotice(''); };
  const list = (rows: Entry[], kind: 'organizations' | 'users') => rows.map(row => <article key={row.id} className="rounded-xl border border-border p-4 flex flex-wrap gap-3 items-center"><div className="flex-1"><h3 className="font-semibold">{row.name}</h3>{row.email && <p>{row.email}</p>}<p>{row.access_suspended_at ? 'Access suspended' : row.active === false ? 'Inactive account' : 'Access not suspended'}</p></div><button className="btn" disabled={busy || row.protected || row.active === false} onClick={() => choose(kind, row)}>{row.protected ? 'Privileged account protected' : row.access_suspended_at ? 'Review restoration' : 'Review suspension'}</button></article>);
  return <Layout currentPage="access-controls"><section className="rounded-2xl border border-border p-5 space-y-4"><h2 className="text-xl font-bold">Account access controls</h2><p className="text-sm text-text-muted">Protected platform accounts require a server-console review by two distinct, freshly passkey-verified platform administrators. These controls cannot override that protection. Deactivation is separate from temporary suspension.</p><p>Suspend a buyer/supplier account or its entire organization. Existing sessions are revoked; organization suspension also revokes pending invitations. This does not cancel trades, transfer inventory or decide payment disputes.</p><p>Platform administration organizations are protected here and require a separate privileged recovery procedure.</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<h3 className="font-bold">Organizations</h3>{list(organizations, 'organizations')}{orgNext && <button className="btn" disabled={busy} onClick={() => { setBusy(true); void loadOrganizations(orgNext).catch(() => setError('Could not load organizations')).finally(() => setBusy(false)); }}>Load more organizations</button>}<label className="block">Organization members<select aria-label="Organization members" className="form-select" value={organization} disabled={busy} onChange={event => void selectOrganization(event.target.value)}><option value="">Select organization</option>{organizations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{list(members, 'users')}{userNext && <button className="btn" disabled={busy} onClick={() => { setBusy(true); void loadMembers(organization, userNext).catch(() => setError('Could not load members')).finally(() => setBusy(false)); }}>Load more members</button>}{selected && <form className="space-y-4 rounded-xl border border-border p-4" onSubmit={event => { event.preventDefault(); void decide(); }}><h3 className="font-bold">{selected.row.access_suspended_at ? 'Restore' : 'Suspend'} access: {selected.row.name}</h3><p>{selected.kind === 'organizations' ? 'Applies to every member of this organization.' : 'Applies only to this member.'} Suspension prevents new authenticated activity. Already authorized requests may finish.</p><label className="block">Decision reason<textarea className="form-input" required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label><label className="block">Current administrator password<input className="form-input" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)} /></label><div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm access decision'}</button><button className="btn" type="button" disabled={busy} onClick={() => { setSelected(null); setPassword(''); setReason(''); }}>Cancel</button></div></form>}</section></Layout>;
}
