import { useUnsavedChanges, useDiscardChanges } from '../components/shared/UnsavedChanges';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import {
  support,
  supportContext,
  supportEntity,
  SUPPORT_CONTEXTS,
  type SupportDraft,
  type SupportRequest,
  type SupportStatus,
} from '../api/support';
import type { CatalogPage } from '../api/http';

export default function SupportPage() {
  const { user } = useAuthCtx();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SupportWorkspace
      key={`${user.id}:${user.organizationId}`}
      admin={user.permissions.includes('*')}
    />
  );
}
function SupportWorkspace({ admin }: { admin: boolean }) {
  const [params] = useSearchParams();
  const [subject, setSubject] = useState(''),
    [description, setDescription] = useState(''),
    [context, setContext] = useState(supportContext(params.get('context')));
  const entityId = supportEntity(params.get('entityId'));
  const [pending, setPending] = useState<SupportDraft | null>(null),
    [saved, setSaved] = useState<SupportRequest | null>(null),
    [sending, setSending] = useState(false),
    [error, setError] = useState('');
  const [operator, setOperator] = useState(false),
    [history, setHistory] = useState<CatalogPage<SupportRequest> | null>(null),
    [historyError, setHistoryError] = useState(''),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SupportRequest | null>(null),
    [status, setStatus] = useState<SupportStatus>('in_review'),
    [reason, setReason] = useState(''),
    [reviewError, setReviewError] = useState(''),
    [reviewBusy, setReviewBusy] = useState(false);
  const contextBaseline = useRef(context);
  const reviewDirty = Boolean(selected && (reason || status !== selected.status));
  useUnsavedChanges(
    Boolean(
      subject || description || pending || reviewDirty || context !== contextBaseline.current,
    ),
    'Support request or review',
  );
  const discard = useDiscardChanges(reviewDirty);
  const generation = useRef(0);
  async function load(cursor?: string) {
    const version = ++generation.current;
    setLoading(true);
    setHistoryError('');
    try {
      const result = await support.page(operator, cursor);
      if (version === generation.current) setHistory(result);
    } catch (e) {
      if (version === generation.current) {
        setHistory(null);
        setHistoryError(e instanceof Error ? e.message : 'History unavailable');
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    setHistory(null);
    void load();
    return () => {
      generation.current++;
    };
  }, [operator]);
  async function submit() {
    if (sending) return;
    if (!pending && (!subject.trim() || !description.trim())) {
      setError('Enter a subject and description with visible text.');
      return;
    }
    const body = pending ?? {
      idempotencyKey: crypto.randomUUID(),
      subject: subject.trim(),
      description: description.trim(),
      context,
      ...(entityId ? { entityId } : {}),
    };
    setPending(body);
    setSending(true);
    setError('');
    try {
      const result = await support.create(body);
      contextBaseline.current = context;
      setSaved(result);
      setPending(null);
      setSubject('');
      setDescription('');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request could not be confirmed');
    } finally {
      setSending(false);
    }
  }
  async function review() {
    if (!selected || reviewBusy) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      const updated = await support.update(selected.id, status, selected.status, reason.trim());
      setSelected(updated);
      setReason('');
      void load();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Review could not be saved');
    } finally {
      setReviewBusy(false);
    }
  }
  return (
    <Layout currentPage="support">
      <section className="space-y-6 max-w-4xl">
        <h2 className="text-2xl font-bold">Support requests</h2>
        <p>
          Send a request for operator review in this authenticated workspace. No automated email is
          sent, and external monitoring or a response time is not guaranteed. Return here to check
          status. Do not include passwords, tokens, or sensitive documents.
        </p>
        <form
          className="space-y-3 rounded-2xl border border-border p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h3 className="text-lg font-bold">Create support request</h3>
          <label htmlFor="support-subject">Subject</label>
          <input
            id="support-subject"
            className="form-input"
            required
            maxLength={120}
            value={subject}
            disabled={!!pending}
            onChange={(e) => setSubject(e.target.value)}
          />
          <label htmlFor="support-description">Description</label>
          <textarea
            id="support-description"
            className="form-input"
            required
            maxLength={2000}
            value={description}
            disabled={!!pending}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label htmlFor="support-context">Context</label>
          <p>Context is captured when this page opens. You can change it before sending.</p>
          <select
            id="support-context"
            className="form-input"
            value={context}
            disabled={!!pending}
            onChange={(e) => setContext(supportContext(e.target.value))}
          >
            {SUPPORT_CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {entityId && <p>Related record: {entityId}</p>}
          {error && <p role="alert">{error}</p>}
          {pending && !sending && (
            <p>
              The result is unconfirmed. Retry sends exactly the same request and reference key to
              avoid duplicates. Fields remain locked until the request is confirmed.
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !subject.trim() || !description.trim()}
          >
            {sending ? 'Sending…' : pending ? 'Retry same request' : 'Send request'}
          </button>
        </form>
        {saved && (
          <p role="status">
            Request saved. Reference: <strong>{saved.reference}</strong>. Status:{' '}
            {saved.status.replace('_', ' ')}.
          </p>
        )}
        {admin && (
          <label>
            <input
              type="checkbox"
              checked={operator}
              onChange={(e) => {
                const checked = e.target.checked;
                discard(() => {
                  generation.current++;
                  setHistory(null);
                  setHistoryError('');
                  setSelected(null);
                  setReason('');
                  setOperator(checked);
                });
              }}
            />{' '}
            Operator review queue
          </label>
        )}
        <section className="space-y-3">
          <h3 className="text-lg font-bold">
            {operator ? 'Operator review queue' : 'Your request history'}
          </h3>
          <button className="btn" disabled={loading} onClick={() => void load()}>
            Refresh requests
          </button>
          {loading && <p role="status">Loading requests…</p>}
          {historyError && (
            <p role="alert">
              History could not be loaded: {historyError}. Use Refresh requests to retry.
            </p>
          )}
          {history && !loading && history.items.length === 0 && <p>No requests on this page.</p>}
          {history &&
            !loading &&
            history.items.map((row) => (
              <article className="border border-border rounded-xl p-4" key={row.id}>
                <h4 className="font-bold">
                  {row.reference}: {row.subject}
                </h4>
                <p>
                  Status: {row.status.replace('_', ' ')} ·{' '}
                  {new Date(row.created_at).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap">{row.description}</p>
                <p>
                  Context: {row.context}
                  {row.entity_id ? ` · ${row.entity_id}` : ''}
                </p>
                {operator && (
                  <button
                    className="btn"
                    onClick={() => {
                      discard(() => {
                        setSelected(row);
                        setStatus(row.status);
                        setReason('');
                        setReviewError('');
                      });
                    }}
                  >
                    Review {row.reference}
                  </button>
                )}
              </article>
            ))}
          {history?.hasMore && (
            <button
              className="btn"
              disabled={loading}
              onClick={() => void load(history.nextCursor!)}
            >
              Next page
            </button>
          )}
        </section>
        {selected && operator && (
          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby="support-review-title"
            className="border border-border rounded-xl p-5 space-y-3"
          >
            <h3 id="support-review-title">Review {selected.reference}</h3>
            <p>Saved status: {selected.status.replace('_', ' ')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void review();
              }}
            >
              <label htmlFor="support-status">New status</label>
              <select
                id="support-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SupportStatus)}
              >
                {['open', 'in_review', 'resolved'].map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <label htmlFor="support-reason">Review reason and follow-up</label>
              <textarea
                id="support-reason"
                className="form-input"
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {reviewError && (
                <p role="alert">
                  {reviewError} Refresh requests, then reload the selected request to review its
                  latest saved status. Your notes are retained.
                </p>
              )}
              <button
                type="button"
                className="btn"
                disabled={
                  reviewBusy || loading || !history?.items.some((row) => row.id === selected.id)
                }
                onClick={() => {
                  const fresh = history?.items.find((row) => row.id === selected.id);
                  if (fresh) {
                    discard(() => {
                      setSelected(fresh);
                      setStatus(fresh.status);
                      setReviewError('');
                    });
                  }
                }}
              >
                Reload selected request from current page
              </button>
              <button type="submit" className="btn btn-primary" disabled={reviewBusy}>
                Save review
              </button>
              <button
                type="button"
                className="btn"
                disabled={reviewBusy}
                onClick={() =>
                  discard(() => {
                    setSelected(null);
                    setReason('');
                  })
                }
              >
                Close review
              </button>
            </form>
          </section>
        )}
      </section>
    </Layout>
  );
}
