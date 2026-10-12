import { useCallback, useEffect, useRef, useState } from 'react';
import { workspace, type FeedbackSummary, type PilotFeedback } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import PageNavigation from '../catalog/PageNavigation';
import { useCatalogPage } from '../catalog/useCatalogPage';
export default function FeedbackRegister() {
  const { canDo } = useAuthCtx();
  return canDo('organization.admin') ? <FeedbackRows /> : null;
}
function FeedbackRows() {
  const [search, setSearch] = useState(''),
    [rating, setRating] = useState('');
  const [totals, setTotals] = useState<FeedbackSummary | null>(null),
    [totalsError, setTotalsError] = useState('');
  const version = useRef(0);
  const fetch = useCallback(async (parameters: Record<string, string>) => {
    const result = await workspace.feedbackPage(parameters);
    if (
      !result ||
      !Array.isArray(result.items) ||
      result.items.length > 100 ||
      !Number.isSafeInteger(result.count) ||
      result.count < result.items.length ||
      result.items.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          ![row.page, row.task, row.comment].every((value) => typeof value === 'string') ||
          !Number.isInteger(row.rating) ||
          row.rating < 1 ||
          row.rating > 5 ||
          !Number.isFinite(Date.parse(row.created_at)) ||
          ![row.user_name, row.organization_name].every(
            (value) => value === null || typeof value === 'string',
          ),
      )
    )
      throw new Error('Invalid feedback page response.');
    return result;
  }, []);
  const page = useCatalogPage<PilotFeedback>(fetch, {
    limit: '50',
    search,
    ...(rating ? { rating } : {}),
  });
  const loadTotals = useCallback(async () => {
    const current = ++version.current;
    setTotalsError('');
    try {
      const result = await workspace.feedbackSummary();
      if (
        !result ||
        ![
          result.count,
          result.rating_1_count,
          result.rating_2_count,
          result.rating_3_count,
          result.rating_4_count,
          result.rating_5_count,
        ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        result.rating_1_count +
          result.rating_2_count +
          result.rating_3_count +
          result.rating_4_count +
          result.rating_5_count !==
          result.count
      )
        throw new Error('Invalid feedback totals response.');
      if (current === version.current) setTotals(result);
    } catch (error) {
      if (current === version.current) {
        setTotals(null);
        setTotalsError(error instanceof Error ? error.message : 'Feedback totals unavailable.');
      }
    }
  }, []);
  useEffect(() => {
    void loadTotals();
    return () => {
      ++version.current;
    };
  }, [loadTotals]);
  return (
    <section
      aria-label="Pilot feedback register"
      className="mt-5 rounded-3xl border border-border bg-surface p-5 space-y-3"
    >
      <h2>
        Pilot feedback — {totals ? totals.count.toLocaleString() : 'total unavailable'} recorded
      </h2>
      <p className="text-xs">
        Feedback is restricted to organizations you administer. Totals cover the full permitted
        history.
      </p>
      {totals && (
        <p>
          {[1, 2, 3, 4, 5]
            .map(
              (value) =>
                `${value} stars: ${totals[`rating_${value}_count` as keyof FeedbackSummary].toLocaleString()}`,
            )
            .join(' · ')}
        </p>
      )}
      {totalsError && (
        <div role="alert">
          {totalsError}
          <button onClick={() => void loadTotals()}>Retry feedback totals</button>
        </div>
      )}
      <input
        aria-label="Search pilot feedback"
        className="form-input"
        maxLength={80}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        aria-label="Feedback rating"
        className="form-select"
        value={rating}
        onChange={(event) => setRating(event.target.value)}
      >
        <option value="">All ratings</option>
        {[1, 2, 3, 4, 5].map((value) => (
          <option key={value} value={value}>
            {value} stars
          </option>
        ))}
      </select>
      {page.loading ? (
        <p role="status">Loading feedback…</p>
      ) : page.error ? (
        <div role="alert">
          {page.error}
          <button onClick={page.refresh}>Retry feedback</button>
        </div>
      ) : page.items.length ? (
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Page</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Contributor</th>
              <th>Organization</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((row) => (
              <tr key={row.id}>
                <td>{row.task}</td>
                <td>{row.page}</td>
                <td>{row.rating}</td>
                <td>{row.comment}</td>
                <td>{row.user_name || 'Unknown contributor'}</td>
                <td>{row.organization_name || 'Unknown organization'}</td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{search || rating ? 'No feedback matches these filters.' : 'No feedback recorded.'}</p>
      )}
      <PageNavigation page={page} label="feedback" />
    </section>
  );
}
