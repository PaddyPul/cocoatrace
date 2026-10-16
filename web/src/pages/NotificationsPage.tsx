import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { notifications, type NoticePage } from '../api/notifications';
export default function NotificationsPage() {
  const { user } = useAuthCtx();
  if (!user) return <Navigate to="/login" replace />;
  return <CurrentNotifications key={`${user.id}:${user.organizationId}`} />;
}
function CurrentNotifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState<NoticePage | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ currentCount: number; unreadCount: number } | null>(
    null,
  );
  const sequence = useRef(0);
  async function load(cursor?: string) {
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const next = await notifications.page(filter, cursor);
      if (request === sequence.current) {
        setPage(next);
        setSummary(next);
      }
    } catch (cause) {
      if (request === sequence.current) {
        setPage(null);
        setError(cause instanceof Error ? cause.message : 'Notifications unavailable');
      }
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [filter]);
  async function toggle(fingerprint: string, read: boolean) {
    setBusy(true);
    setError('');
    try {
      await notifications.read(fingerprint, read);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Read receipt unavailable');
      setBusy(false);
    }
  }
  return (
    <Layout currentPage="notifications">
      <div className="space-y-4">
        <p>
          Current trade actions and waiting notices. This is not a historical inbox. Notices
          disappear when the current action changes or ends. Review the deal for its full current
          status.
        </p>
        <p aria-live="polite">
          {summary
            ? `${summary.unreadCount} unread of ${summary.currentCount} current notices`
            : 'Unread count unavailable'}
        </p>
        <label>
          Show notices{' '}
          <select
            value={filter}
            disabled={busy}
            onChange={(event) => setFilter(event.target.value as 'all' | 'unread')}
          >
            <option value="all">All current notices</option>
            <option value="unread">Unread current notices</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void load()}>
          Refresh notifications
        </button>
        {error && (
          <div role="alert">
            {error}{' '}
            <button type="button" disabled={busy} onClick={() => void load()}>
              Retry notifications
            </button>
          </div>
        )}
        {busy && <p role="status">Loading notifications…</p>}
        {page?.items.length === 0 && (
          <p>No {filter === 'unread' ? 'unread ' : ''}current notices.</p>
        )}
        {page?.items.map((item) => (
          <article key={item.fingerprint} className="rounded border p-4 space-y-2">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <p>
              {item.responsibleParty === 'you'
                ? 'Action required from you'
                : item.responsibleParty === 'other'
                  ? 'Waiting on another party'
                  : 'No action required'}
            </p>
            <Link to={item.actionPath}>{item.actionLabel}</Link>
            <label className="block">
              <input
                type="checkbox"
                checked={item.read}
                disabled={busy}
                onChange={(event) => void toggle(item.fingerprint, event.target.checked)}
              />{' '}
              Mark “{item.title}” as read
            </label>
          </article>
        ))}
        {page?.hasMore && (
          <button type="button" disabled={busy} onClick={() => void load(page.nextCursor!)}>
            Next notices
          </button>
        )}
      </div>
    </Layout>
  );
}
