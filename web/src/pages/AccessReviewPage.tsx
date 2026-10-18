import { useUnsavedChanges } from '../components/shared/UnsavedChanges';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { api } from '../api';
type Row = {
  id: string;
  name: string;
  email: string;
  organization_name: string;
  active: boolean;
  verification_status: string;
  access_suspended_at: string | null;
  organization_suspended_at: string | null;
  created_at: string;
  last_retained_activity_at: string | null;
  activityFinding: string;
};
type Report = {
  snapshotHash: string;
  due: boolean;
  latestReview: null | { reviewed_at: string; next_due_at: string };
  snapshot: {
    rows: Row[];
    counts: {
      total: number;
      unavailable: number;
      unknownActivity: number;
      staleRetainedEvidence: number;
    };
  };
};
export default function AccessReviewPage() {
  const { user } = useAuthCtx();
  const allowed = Boolean(user?.permissions.includes('*'));
  const [report, setReport] = useState<Report | null>(null),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useUnsavedChanges(Boolean(reason || confirmed), 'Privileged access review');
  async function load() {
    setReport(null);
    setConfirmed(false);
    setReport(await api<Report>('GET', '/admin/access-review'));
  }
  useEffect(() => {
    if (allowed) void load().catch((e) => setError(e.message));
  }, [allowed]);
  if (!allowed) return <Navigate to="/home" replace />;
  async function record() {
    if (!report || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('POST', '/admin/access-review', {
        reason,
        confirmed,
        expectedSnapshotHash: report.snapshotHash,
      });
      setReason('');
      await load();
      setNotice('Review receipt recorded. Findings remain open for follow-up.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record review');
      setReport(null);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout currentPage="access-review">
      <section className="rounded-2xl border border-border p-5 space-y-4">
        <h2 className="text-xl font-bold">Privileged access review</h2>
        <p>
          Private platform administrator roster. Review every account, retain findings and record
          follow-up in the reason. Recording acknowledges this snapshot; it does not certify that
          all access is safe or resolve findings.
        </p>
        <p>
          Activity uses retained session evidence only. Missing evidence means unknown. Evidence
          older than 90 days is a stale-account investigation signal, not proof of inactivity.
          Account creation is context, not sign-in evidence.
        </p>
        <p>
          Protected-account changes and recovery still require two distinct freshly verified
          reviewers through the privileged lifecycle procedure.
        </p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setError('');
            void load().catch((e) => setError(e.message));
          }}
        >
          Reload complete roster
        </button>
        {report && (
          <>
            <p>
              {report.due ? 'Review due' : 'Review current'} · Next due:{' '}
              {report.latestReview
                ? new Date(report.latestReview.next_due_at).toLocaleString()
                : 'No review recorded'}
            </p>
            <p>
              {report.snapshot.counts.total} privileged accounts ·{' '}
              {report.snapshot.counts.unavailable} unavailable ·{' '}
              {report.snapshot.counts.unknownActivity} unknown activity ·{' '}
              {report.snapshot.counts.staleRetainedEvidence} stale retained evidence
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Organization</th>
                    <th>Access</th>
                    <th>Created</th>
                    <th>Retained activity evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.snapshot.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.name}
                        <br />
                        {row.email}
                      </td>
                      <td>{row.organization_name}</td>
                      <td>
                        {!row.active
                          ? 'Inactive'
                          : row.access_suspended_at || row.organization_suspended_at
                            ? 'Suspended'
                            : row.verification_status !== 'verified'
                              ? 'Organization unverified'
                              : 'Not suspended'}
                      </td>
                      <td>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td>
                        {row.activityFinding.replace(/_/g, ' ')}
                        <br />
                        {row.last_retained_activity_at
                          ? new Date(row.last_retained_activity_at).toLocaleString()
                          : 'No retained evidence'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void record();
              }}
            >
              <label className="block">
                Review reason and follow-up
                <textarea
                  className="form-input"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                I reviewed the complete snapshot and retained the findings.
              </label>
              <button className="btn btn-primary" disabled={busy || !confirmed}>
                Record review receipt
              </button>
            </form>
          </>
        )}
      </section>
    </Layout>
  );
}
