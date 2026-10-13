import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';

type Job = {
  job_name: string;
  status: string;
  error_code: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
};
type Ticket = { id: string; last_error_code: string | null; attempts: number };
const names = ['evidence_scan', 'evidence_cleanup', 'payment_reminders', 'recall_email'];
const unsafe = ['LIVE_EVIDENCE_REFERENCE', 'INVALID_OBJECT_KEY', 'STORAGE_PROVIDER_MISMATCH'];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function code(value: unknown) {
  return value === null || (typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value));
}
function statuses(value: unknown): value is { healthy: boolean; jobs: Job[] } {
  if (
    !record(value) ||
    typeof value.healthy !== 'boolean' ||
    !Array.isArray(value.jobs) ||
    value.jobs.length > 4
  )
    return false;
  const seen = new Set<string>();
  return (
    value.jobs.every((row) => {
      if (
        !record(row) ||
        typeof row.job_name !== 'string' ||
        !names.includes(row.job_name) ||
        seen.has(row.job_name) ||
        !['running', 'succeeded', 'failed'].includes(String(row.status)) ||
        !code(row.error_code) ||
        !(
          row.last_success_at === null ||
          (typeof row.last_success_at === 'string' &&
            Number.isFinite(Date.parse(row.last_success_at)))
        ) ||
        !Number.isSafeInteger(row.consecutive_failures) ||
        Number(row.consecutive_failures) < 0
      )
        return false;
      seen.add(row.job_name);
      return true;
    }) &&
    (!value.healthy ||
      (value.jobs.length === 4 &&
        value.jobs.every(
          (row) =>
            record(row) &&
            row.status !== 'failed' &&
            row.error_code === null &&
            row.last_success_at !== null &&
            row.consecutive_failures === 0,
        )))
  );
}
function tickets(value: unknown): value is { items: Ticket[]; more: boolean } {
  return (
    record(value) &&
    typeof value.more === 'boolean' &&
    Array.isArray(value.items) &&
    value.items.length <= 50 &&
    value.items.every(
      (row) =>
        record(row) &&
        typeof row.id === 'string' &&
        /^[0-9a-f-]{36}$/i.test(row.id) &&
        row.state === 'dead' &&
        code(row.last_error_code) &&
        Number.isSafeInteger(row.attempts) &&
        Number(row.attempts) >= 0,
    )
  );
}

export default function OperationsPage() {
  const { canDo } = useAuthCtx();
  const allowed = canDo('*');
  const [data, setData] = useState<{ healthy: boolean; jobs: Job[] } | null>(null),
    [dead, setDead] = useState<{ items: Ticket[]; more: boolean } | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState<Ticket | null>(null),
    [reason, setReason] = useState(''),
    [saving, setSaving] = useState(false),
    [decisionError, setDecisionError] = useState('');
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!allowed) return;
    const current = ++version.current;
    setLoading(true);
    try {
      const [status, queue] = await Promise.all([
        api<unknown>('GET', '/operations/status'),
        api<unknown>('GET', '/operations/cleanup/dead'),
      ]);
      if (!statuses(status) || !tickets(queue))
        throw new Error('Invalid operations response. Retry to refresh.');
      if (current === version.current) {
        setData(status);
        setDead(queue);
        setError('');
      }
    } catch {
      if (current === version.current) {
        setData(null);
        setDead(null);
        setError(
          'Operations status unavailable. Retry to refresh; healthy operation has not been confirmed.',
        );
      }
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [allowed]);
  useEffect(() => {
    void refresh();
    return () => {
      version.current++;
    };
  }, [refresh]);
  const retry = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setDecisionError('');
    try {
      const result = await api<unknown>('POST', `/operations/cleanup/${selected.id}/retry`, {
        reason: reason.trim(),
      });
      if (!record(result) || result.queued !== true) throw new Error('Retry was not confirmed');
      setSelected(null);
      setReason('');
      await refresh();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'Retry was not confirmed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Layout currentPage="operations">
      <section aria-label="Operations monitor" className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold">Operations monitor</h1>
        {!allowed ? (
          <p role="alert">Platform administrator access required.</p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Scheduled evidence scans, cleanup and notification delivery. This monitor does not
              confirm email inbox delivery or release retained inventory.
            </p>
            <button className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
              Refresh operations
            </button>
            {loading && <p role="status">Refreshing operations…</p>}
            {error && <p role="alert">{error}</p>}
            {data && (
              <>
                <p role="status">
                  {data.healthy ? 'Scheduled jobs healthy' : 'Scheduled jobs need attention'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>State</th>
                        <th>Last successful run</th>
                        <th>Incident</th>
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name) => {
                        const job = data.jobs.find((row) => row.job_name === name);
                        return (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{job?.status ?? 'Not yet observed'}</td>
                            <td>
                              {job?.last_success_at
                                ? new Date(job.last_success_at).toLocaleString()
                                : 'No successful run recorded'}
                            </td>
                            <td>{job?.error_code ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {dead && (
              <section aria-label="Terminal cleanup">
                <h2 className="text-lg font-bold">Terminal cleanup</h2>
                <p className="text-sm">
                  Quota stays charged until physical deletion succeeds. Live evidence, invalid keys
                  and provider mismatches require investigation.
                </p>
                {dead.items.length === 0 ? (
                  <p>No terminal cleanup records observed.</p>
                ) : (
                  <ul className="space-y-3">
                    {dead.items.map((item) => (
                      <li key={item.id} className="rounded-lg border border-border p-3">
                        <span>
                          {item.id} · {item.last_error_code ?? 'Unknown incident'} · {item.attempts}{' '}
                          attempts
                        </span>
                        {!unsafe.includes(item.last_error_code ?? '') && (
                          <button
                            className="btn-secondary ml-3"
                            onClick={() => {
                              setSelected(item);
                              setReason('');
                              setDecisionError('');
                            }}
                          >
                            Review cleanup retry
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {dead.more && (
                  <p role="status">
                    Showing the first 50 terminal records. Resolve reviewed incidents and refresh
                    for the next records.
                  </p>
                )}
              </section>
            )}
            {selected && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Cleanup recovery"
                className="rounded-xl border border-border bg-surface p-5"
              >
                <h2 className="text-lg font-bold">Review cleanup retry</h2>
                <p>{selected.id}</p>
                <p className="text-sm">
                  Investigate the incident before requeueing. The worker rechecks references and
                  storage safety; this action cannot delete evidence directly.
                </p>
                <label className="block">
                  Recovery explanation
                  <textarea
                    className="form-input"
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={saving}
                  />
                </label>
                {decisionError && <p role="alert">{decisionError}</p>}
                <button
                  className="btn-primary"
                  onClick={() => void retry()}
                  disabled={saving || reason.trim().length < 10}
                >
                  Queue reviewed retry
                </button>
                <button
                  className="btn-secondary ml-3"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  Cancel recovery
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
