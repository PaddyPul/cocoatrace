import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  teamMembers,
  type MemberPage,
  type TeamMember,
  type TeamRole,
} from '../../api/teamMembers';
import { useAuthCtx } from '../auth/AuthProvider';

export default function TeamMembers() {
  const { user } = useAuthCtx();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [page, setPage] = useState<MemberPage | null>(null);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [rolesError, setRolesError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const version = useRef(0);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [action, setAction] = useState<'role' | 'deactivate'>('role');
  const [role, setRole] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    setError('');
    try {
      const result = await teamMembers.page(query, cursor);
      if (request === version.current) setPage(result);
    } catch (err) {
      if (request === version.current) {
        setPage(null);
        setError(err instanceof Error ? err.message : 'Members unavailable.');
      }
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [query, cursor]);
  const loadRoles = useCallback(async () => {
    setRolesError('');
    try {
      setRoles(await teamMembers.roles());
    } catch (err) {
      setRoles([]);
      setRolesError(err instanceof Error ? err.message : 'Assignable roles unavailable.');
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      ++version.current;
    };
  }, [load]);
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);
  const close = () => {
    setSelected(null);
    setPassword('');
    setReason('');
    setConfirmation('');
    setMutationError('');
  };
  const open = (member: TeamMember, nextAction: 'role' | 'deactivate') => {
    setSelected(member);
    setAction(nextAction);
    setRole('');
    setPassword('');
    setReason('');
    setConfirmation('');
    setMutationError('');
    setNotice('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selected ||
      confirmation !== selected.email ||
      reason.trim().length < 10 ||
      !password ||
      (action === 'role' && (!role || !roles.some((item) => item.name === role)))
    )
      return;
    setBusy(true);
    setMutationError('');
    try {
      const data = { reason: reason.trim(), currentPassword: password };
      const result =
        action === 'role'
          ? await teamMembers.changeRole(selected.id, { ...data, role })
          : await teamMembers.deactivate(selected.id, data);
      close();
      setNotice(
        !result.changed
          ? 'No change was needed; member access was already updated.'
          : action === 'role'
            ? 'Member role updated. Existing sessions were revoked.'
            : 'Member deactivated. Existing sessions were revoked.',
      );
      await load();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Member change failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Organization members"
      className="mt-5 rounded-3xl border border-border bg-surface p-6"
    >
      <h2 className="text-lg font-bold">Organization members</h2>
      <p className="mt-2 text-sm text-text-muted">
        Review member access. Role changes and deactivation revoke existing sessions. Your own
        account, protected accounts, and the last administrator cannot be changed here.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setHistory([]);
          setQuery(search.trim());
        }}
      >
        <input
          className="form-input"
          aria-label="Search members"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn" type="submit">
          Search members
        </button>
        <button className="btn" type="button" onClick={() => void load()}>
          Refresh members
        </button>
      </form>
      {notice && (
        <p role="status" className="mt-3">
          {notice}
        </p>
      )}
      {rolesError && (
        <p role="alert">
          {rolesError}{' '}
          <button className="btn btn-sm" onClick={() => void loadRoles()}>
            Retry roles
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading members…</p>
      ) : error ? (
        <p role="alert">
          {error}{' '}
          <button className="btn btn-sm" onClick={() => void load()}>
            Retry members
          </button>
        </p>
      ) : (
        page && (
          <>
            <p className="mt-3 text-xs text-text-muted">{page.rows.length} members on this page</p>
            <div className="mt-3 space-y-3">
              {page.rows.map((member) => {
                const denial =
                  member.id === user?.id
                    ? 'Your own account cannot be changed here.'
                    : !member.manageable
                      ? 'Protected account: changes are not available here.'
                      : !member.active
                        ? 'This member is inactive.'
                        : '';
                return (
                  <article
                    key={member.id}
                    aria-label={member.email}
                    className="rounded-xl border border-border p-4"
                  >
                    <h3 className="font-semibold">
                      {member.name} · {member.email}
                    </h3>
                    <p className="text-sm">
                      {member.roles.join(', ') || 'No role'} ·{' '}
                      {!member.active
                        ? 'Inactive'
                        : member.accessSuspended
                          ? 'Access suspended'
                          : 'Active'}
                      {member.legacy ? ' · Legacy role assignment' : ''}
                    </p>
                    {denial && <p className="text-xs text-text-muted">{denial}</p>}
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn btn-sm"
                        disabled={!!denial || !roles.length || busy}
                        onClick={() => open(member, 'role')}
                      >
                        Change role
                      </button>
                      <button
                        className="btn btn-sm text-red-300"
                        disabled={!!denial || busy}
                        onClick={() => open(member, 'deactivate')}
                      >
                        Deactivate member
                      </button>
                    </div>
                  </article>
                );
              })}
              {!page.rows.length && <p>No members match this search.</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="btn btn-sm"
                disabled={!history.length}
                onClick={() => {
                  setCursor(history[history.length - 1]);
                  setHistory(history.slice(0, -1));
                }}
              >
                Previous members
              </button>
              <button
                className="btn btn-sm"
                disabled={!page.next}
                onClick={() => {
                  setHistory([...history, cursor]);
                  setCursor(page.next || undefined);
                }}
              >
                Next members
              </button>
            </div>
          </>
        )
      )}
      {selected && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="member-change-title"
          className="mt-5 rounded-xl border border-red-400/40 bg-surface-darker p-5"
        >
          <h3 id="member-change-title" className="font-bold">
            {action === 'role' ? 'Confirm role change' : 'Confirm member deactivation'}
          </h3>
          <p className="mt-2">
            {selected.email} currently has: {selected.roles.join(', ') || 'no role'}.{' '}
            {action === 'deactivate'
              ? 'They will lose access to this organization.'
              : 'The selected role replaces their current role.'}
          </p>
          <form onSubmit={submit} className="mt-3 space-y-3">
            {action === 'role' && (
              <label className="block">
                New member role
                <select
                  className="form-select"
                  required
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  <option value="">Select a role</option>
                  {roles.map((item) => (
                    <option
                      key={item.name}
                      value={item.name}
                      disabled={item.name === selected.role}
                    >
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {action === 'role' && role && (
              <p className="text-xs">
                Permissions:{' '}
                {roles.find((item) => item.name === role)?.permissions.join(', ') || 'None'}
              </p>
            )}
            <label className="block">
              Reason for member change (at least 10 characters)
              <textarea
                className="form-input"
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="block">
              Current password
              <input
                className="form-input"
                type="password"
                autoComplete="current-password"
                maxLength={1024}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="block">
              Type {selected.email} to confirm
              <input
                className="form-input"
                aria-label="Confirm member email"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {mutationError && <p role="alert">{mutationError}</p>}
            <div className="flex gap-2">
              <button
                className="btn text-red-300"
                disabled={
                  busy ||
                  confirmation !== selected.email ||
                  reason.trim().length < 10 ||
                  !password ||
                  (action === 'role' && (!role || role === selected.role))
                }
              >
                {busy
                  ? 'Saving member change…'
                  : action === 'role'
                    ? 'Confirm role change'
                    : 'Confirm deactivation'}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={close}>
                Cancel member change
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
