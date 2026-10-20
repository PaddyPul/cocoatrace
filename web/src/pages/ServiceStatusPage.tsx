import { useEffect, useState } from 'react';
import { observeService, type StatusObservation } from '../components/serviceStatus/status';

export default function ServiceStatusPage() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<StatusObservation | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let expiration: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setResult(null);
    setStale(false);
    const deadline = setTimeout(() => controller.abort(), 5000);
    void observeService(fetch, controller.signal)
      .then((observation) => {
        if (!active) return;
        setResult(observation);
        setCheckedAt(Date.now());
        setLoading(false);
        expiration = setTimeout(() => {
          if (active) setStale(true);
        }, 60_000);
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(deadline);
      clearTimeout(expiration);
    };
  }, [attempt]);
  const label = (status: StatusObservation[keyof StatusObservation] | undefined) =>
    stale || !status || status === 'unknown'
      ? 'Unknown'
      : status === 'available'
        ? 'Responding'
        : 'Not ready';
  return (
    <main className="min-h-screen bg-surface-darker px-5 py-10 text-text-primary">
      <article className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">Service status</h1>
        <p>
          Point-in-time checks from this browser. These are not an uptime history, an incident feed
          or confirmation that a trade, payment, evidence upload or email succeeded.
        </p>
        {loading ? (
          <p role="status">Checking service…</p>
        ) : (
          <section
            aria-label="Latest service observation"
            aria-live="polite"
            className="space-y-3 rounded-xl border border-border p-5"
          >
            <p>
              API process: <strong>{label(result?.process)}</strong>
            </p>
            <p>
              Required dependencies: <strong>{label(result?.dependencies)}</strong>
            </p>
            {(stale || result?.process === 'unknown' || result?.dependencies === 'unknown') && (
              <p role="alert">
                Status is unknown. A network problem or an unavailable check is not evidence that
                records are empty or actions failed. Refresh before relying on this observation.
              </p>
            )}
            {checkedAt && (
              <p className="text-sm">
                Last check: {new Date(checkedAt).toLocaleTimeString()}
                {stale ? ' — out of date' : ''}
              </p>
            )}
          </section>
        )}
        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Refresh service status
        </button>
        <p>
          Database, private storage and scanning readiness are checked together. A responding
          process does not confirm those dependencies. This page does not test banks, external inbox
          delivery or physical safety.
        </p>
        <nav aria-label="Status page navigation" className="flex flex-wrap gap-4">
          <a className="underline" href="/home">
            Return to workspace
          </a>
          <a className="underline" href="/platform-role">
            Platform responsibilities
          </a>
        </nav>
      </article>
    </main>
  );
}
