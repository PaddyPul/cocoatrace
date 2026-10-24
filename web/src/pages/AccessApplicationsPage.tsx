import WorkspaceDialog from '../components/shared/WorkspaceDialog';
import { useUnsavedChanges, useDiscardChanges } from '../components/shared/UnsavedChanges';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, ClipboardCopy, ShieldCheck, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import {
  AccessApplication,
  AccessApplicationSummary,
  accessApplications,
  invitations,
} from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';

import PageNavigation from '../components/catalog/PageNavigation';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
export default function AccessApplicationsPage() {
  const { user } = useAuthCtx();
  return user?.permissions.includes('*') ? <AccessReview /> : <Navigate to="/home" replace />;
}
function AccessReview() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [totals, setTotals] = useState<AccessApplicationSummary | null>(null);
  const [totalsError, setTotalsError] = useState('');
  const summaryVersion = useRef(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending_review');
  const [selected, setSelected] = useState<AccessApplication | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  const fetch = useCallback(async (parameters: Record<string, string>) => {
    const result = await accessApplications.page(parameters);
    if (
      !result ||
      !Number.isSafeInteger(result.count) ||
      result.count < 0 ||
      !Array.isArray(result.items) ||
      result.items.length > 100 ||
      result.count < result.items.length ||
      result.items.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          ![row.organizationName, row.jurisdiction, row.adminName, row.adminEmail].every(
            (value) => typeof value === 'string',
          ) ||
          !['buyer', 'supplier'].includes(row.organizationType) ||
          !['pending_email_verification', 'pending_review', 'approved', 'rejected'].includes(
            row.status,
          ) ||
          !Number.isFinite(Date.parse(row.createdAt)) ||
          ![row.reviewReason, row.legalRegistrationNumber, row.firstAdminInvitationId].every(
            (value) => value === null || value === undefined || typeof value === 'string',
          ),
      )
    )
      throw new Error('Invalid access application page response.');
    return result;
  }, []);
  const page = useCatalogPage<AccessApplication>(fetch, {
    limit: '50',
    search,
    ...(status === 'all' ? {} : { status }),
  });
  const loadTotals = useCallback(async () => {
    const version = ++summaryVersion.current;
    setTotalsError('');
    try {
      const result = await accessApplications.summary();
      if (
        !result ||
        ![
          result.count,
          result.pending_email_verification_count,
          result.pending_review_count,
          result.approved_count,
          result.rejected_count,
        ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        result.pending_email_verification_count +
          result.pending_review_count +
          result.approved_count +
          result.rejected_count !==
          result.count
      )
        throw new Error('Invalid access application totals response.');
      if (version === summaryVersion.current) setTotals(result);
    } catch (error) {
      if (version === summaryVersion.current) {
        setTotals(null);
        setTotalsError(error instanceof Error ? error.message : 'Application totals unavailable.');
      }
    }
  }, []);
  useEffect(() => {
    void loadTotals();
    return () => {
      ++summaryVersion.current;
    };
  }, [loadTotals]);
  const load = async () => {
    page.refresh();
    await loadTotals();
  };
  const visible = page.items;
  const loading = page.loading;

  useUnsavedChanges(Boolean(selected && reason), 'Access application review');
  const discard = useDiscardChanges(Boolean(selected && reason));
  const decide = async (decision: 'approve' | 'reject') => {
    if (!selected) return;
    if (decision === 'reject' && !reason.trim()) {
      setError('Record a reason before rejecting an organization.');
      return;
    }
    setBusy(true);
    setError('');
    setInviteUrl('');
    try {
      if (decision === 'approve') {
        const result = await accessApplications.approve(selected.id, reason.trim() || undefined);
        setInviteUrl(result.inviteUrl || '');
        toast(
          result.emailDelivery === 'failed' ? 'error' : 'success',
          result.emailDelivery === 'sent'
            ? 'Organization approved; invitation submitted to email provider'
            : result.emailDelivery === 'pending'
              ? 'Invitation saved and queued for email delivery'
              : result.emailDelivery === 'failed'
                ? 'Organization approved, but email submission failed. Use Resend admin invitation.'
                : 'Organization approved; email is disabled in this demo',
        );
      } else {
        await accessApplications.reject(selected.id, reason.trim());
      }
      setSelected(null);
      setReason('');
      if (decision === 'reject') toast('success', 'Access application rejected');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Could not ${decision} the application`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout
      currentPage="access-applications"
      actions={
        <select
          aria-label="Filter applications"
          className="form-select min-w-44"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="pending_review">Awaiting review</option>
          <option value="pending_email_verification">Email not verified</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All applications</option>
        </select>
      }
    >
      <section className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.09),rgba(255,255,255,.02))] p-5 sm:p-6">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-400/10 text-brand-400">
            <ShieldCheck size={20} />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">
              Platform administration
            </div>
            <h2 className="mt-1 text-2xl font-bold">Organization access review</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-text-muted">
              Email verification proves control of an address, not the legitimacy of an
              organization. Review the submitted identity independently before creating the first
              administrator invitation.
            </p>
          </div>
        </div>
      </section>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-300"
        >
          {error}
        </div>
      )}
      {inviteUrl && (
        <div className="mt-4 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-4">
          <div className="text-xs font-bold text-brand-300">Demo invitation created</div>
          <p className="mt-1 text-[10px] text-text-muted">
            Use this local link for testing. Check the email submission result before assuming a
            message was sent. The link is exposed here only when the API is running in demo/test
            mode.
          </p>
          <div className="mt-3 flex gap-2">
            <input readOnly className="form-input min-w-0 flex-1" value={inviteUrl} />
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
                toast('success', 'Invitation link copied');
              }}
            >
              <ClipboardCopy size={14} />
              Copy
            </button>
          </div>
        </div>
      )}
      <section
        aria-label="Access application register"
        className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6"
      >
        <h2>
          Applications — {totals ? totals.count.toLocaleString() : 'total unavailable'} recorded
        </h2>
        {totals && (
          <p>
            {totals.pending_review_count.toLocaleString()} awaiting review ·{' '}
            {totals.pending_email_verification_count.toLocaleString()} email not verified ·{' '}
            {totals.approved_count.toLocaleString()} approved ·{' '}
            {totals.rejected_count.toLocaleString()} rejected
          </p>
        )}
        {totalsError && (
          <div role="alert">
            {totalsError}
            <button onClick={() => void loadTotals()}>Retry application totals</button>
          </div>
        )}
        <input
          aria-label="Search access applications"
          className="form-input my-3"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Loading access applications…
          </div>
        ) : page.error ? (
          <div role="alert">
            {page.error}
            <button onClick={page.refresh}>Retry applications</button>
          </div>
        ) : visible.length ? (
          <div className="space-y-3">
            {visible.map((row) => (
              <article
                key={row.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-darker p-4 md:flex-row md:items-center"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-text-muted">
                  <Building2 size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{row.organizationName}</h3>
                    <Status value={row.status} />
                  </div>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {row.organizationType} · {row.jurisdiction}
                    {row.legalRegistrationNumber ? ` · ${row.legalRegistrationNumber}` : ''}
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    {row.adminName} · {row.adminEmail}
                  </p>
                  <p className="mt-1 text-[9px] text-text-muted">
                    Submitted {formatDate(row.createdAt)}
                  </p>
                </div>
                {row.status === 'pending_review' ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      discard(() => {
                        setSelected(row);
                        setReason('');
                      });
                      setError('');
                    }}
                  >
                    Review
                  </button>
                ) : row.status === 'approved' && row.firstAdminInvitationId ? (
                  <button
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const result = await invitations.resend(row.firstAdminInvitationId!);
                        setInviteUrl(result.inviteUrl || '');
                        toast(
                          result.emailDelivery === 'failed' ? 'error' : 'success',
                          result.emailDelivery === 'sent'
                            ? 'Admin invitation submitted to email provider'
                            : result.emailDelivery === 'pending'
                              ? 'Invitation saved and queued for email delivery'
                              : result.emailDelivery === 'failed'
                                ? 'Email submission failed; retry after checking the provider'
                                : 'Email disabled; demo link created',
                        );
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : 'Invitation resend failed.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Resend admin invitation
                  </button>
                ) : (
                  <span className="text-[10px] text-text-muted">
                    {row.reviewReason || 'No review note recorded'}
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Check size={28} className="mx-auto text-brand-400" />
            <h3 className="mt-4 text-sm font-semibold">No matching applications</h3>
            <p className="mt-2 text-xs text-text-muted">No applications match these filters.</p>
          </div>
        )}
        <PageNavigation page={page} label="applications" />
      </section>
      {selected && (
        <WorkspaceDialog
          label="Access decision"
          onClose={() =>
            !busy &&
            discard(() => {
              setSelected(null);
              setReason('');
            })
          }
        >
          <div className="modal">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.14em] text-brand-400">
                  Access decision
                </div>
                <h2 className="mt-1 text-xl font-bold">{selected.organizationName}</h2>
                <p className="mt-2 text-xs text-text-muted">
                  Proposed {selected.organizationType} administrator: {selected.adminName} (
                  {selected.adminEmail})
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  discard(() => {
                    setSelected(null);
                    setReason('');
                  })
                }
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-5">
              <label htmlFor="access-review-reason" className="form-label">
                Review reason or note
              </label>
              <textarea
                id="access-review-reason"
                className="form-input min-h-28"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required for rejection; recommended for approval"
              />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                disabled={busy}
                className="btn justify-center border-red-400/30 text-red-300"
                onClick={() => decide('reject')}
              >
                <X size={14} />
                Reject
              </button>
              <button
                disabled={busy}
                className="btn btn-primary justify-center"
                onClick={() => decide('approve')}
              >
                <Check size={14} />
                Approve and invite
              </button>
            </div>
          </div>
        </WorkspaceDialog>
      )}
    </Layout>
  );
}

function Status({ value }: { value: string }) {
  const style =
    value === 'approved'
      ? 'badge-green'
      : value === 'rejected'
        ? 'badge-red'
        : value === 'pending_review'
          ? 'badge-amber'
          : 'badge-gray';
  return <span className={`badge ${style}`}>{value.split('_').join(' ')}</span>;
}
function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
