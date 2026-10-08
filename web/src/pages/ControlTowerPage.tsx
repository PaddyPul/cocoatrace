import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workspaceOverview, type WorkspaceOverview } from '../api';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { validateOverview } from '../components/dashboard/overview';
import { SkeletonDetail } from '../components/shared/Skeleton';
import ReadinessAssistant from '../components/dashboard/ReadinessAssistant';
export default function ControlTowerPage() {
  const { user, canDo } = useAuthCtx(),
    navigate = useNavigate();
  const [data, setData] = useState<WorkspaceOverview | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const load = () => {
      const request = ++sequence;
      setLoading(true);
      setData(null);
      setError('');
      workspaceOverview()
        .then(validateOverview)
        .then((row) => {
          if (active && request === sequence) setData(row);
        })
        .catch(() => {
          if (active && request === sequence)
            setError(
              'Workspace totals could not be refreshed. Recommendations are paused; retry to load current records.',
            );
        })
        .finally(() => {
          if (active && request === sequence) setLoading(false);
        });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
    };
  }, [user?.id, retry]);
  if (loading)
    return (
      <Layout currentPage="dashboard">
        <SkeletonDetail />
      </Layout>
    );
  if (error || !data)
    return (
      <Layout currentPage="dashboard">
        <div role="alert">
          {error || 'Workspace totals unavailable.'}
          <button className="btn" onClick={() => setRetry((n) => n + 1)}>
            Retry workspace totals
          </button>
        </div>
      </Layout>
    );
  const metrics: Array<{ label: string; value: string; note: string; path: string }> = [];
  if (data.batches)
    metrics.push({
      label: 'Accessible batches',
      value: String(data.batches.count),
      note: `${data.batches.reviewed_count} organic certificate reviews`,
      path: '/batches',
    });
  if (data.products)
    metrics.push(
      {
        label: 'Published products',
        value: String(data.products.published_count),
        note: `${data.products.count} accessible product identities`,
        path: '/products',
      },
      {
        label: 'Products with safety holds',
        value: String(data.products.held_count),
        note: 'Includes retained recall holds and returned/disposed material',
        path: '/recalls',
      },
    );
  if (data.lots)
    metrics.push({
      label: 'Recorded source quantity',
      value: `${Number(data.lots.source_kg).toLocaleString()} kg`,
      note: `${data.lots.count} accessible lots; source quantities are not available stock`,
      path: '/recalls',
    });
  if (data.evidence)
    metrics.push({
      label: 'Evidence records',
      value: String(data.evidence.count),
      note: 'Recorded metadata; not a count of approved or scan-clean files',
      path: '/evidence',
    });
  if (data.shipments)
    metrics.push({
      label: 'Active transport',
      value: String(data.shipments.active_count),
      note: `${data.shipments.count} transport records`,
      path: '/shipments',
    });
  if (data.contracts)
    metrics.push({
      label: 'Active deals',
      value: String(data.contracts.active_count),
      note: `${data.contracts.count} contract records`,
      path: '/contracts',
    });
  if (data.offers)
    metrics.push({
      label: 'Pending received offers',
      value: String(data.offers.received_pending),
      note: `${data.offers.sent_pending} sent offers awaiting a response`,
      path: '/offers',
    });
  if (data.payments)
    metrics.push({
      label: 'Open payment workflows',
      value: String(data.payments.open_count),
      note: 'Workflow count; not money received or a dispatch authorization',
      path: '/payments',
    });
  if (data.farms)
    metrics.push({
      label: 'Accessible farms',
      value: String(data.farms.count),
      note: `${data.farms.owned_count} owned source records`,
      path: '/farms',
    });
  if (data.listings)
    metrics.push({
      label: 'My published listings',
      value: String(data.listings.own_count),
      note: `${data.listings.count} visible marketplace listings`,
      path: '/my-listings',
    });
  return (
    <Layout currentPage="dashboard">
      <section className="rounded-3xl border border-border bg-surface p-6">
        <h2 className="text-3xl font-bold">Workspace overview</h2>
        <p className="mt-3 text-sm text-text-muted">
          Full totals for records your account may read. Resource scopes can differ; these are not
          network-wide counts or compliance decisions.
        </p>
      </section>
      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            className="stat-card text-left"
            onClick={() => navigate(metric.path)}
            aria-label={`Open ${metric.label}`}
          >
            <div className="stat-label">{metric.label}</div>
            <div className="stat-value">{metric.value}</div>
            <p className="mt-2 text-xs text-text-muted">{metric.note}</p>
          </button>
        ))}
      </section>
      <section className="mt-5 rounded-3xl border border-border bg-surface p-5">
        <h3 className="font-bold">Safety notices connected to your access</h3>
        <p className="mt-3">{data.recalls.active_count} active recall notices</p>
        {data.recalls.active_count > 0 ? (
          <button className="btn mt-3" onClick={() => navigate('/recalls')}>
            Review safety notices
          </button>
        ) : (
          <p className="mt-2 text-xs text-text-muted">
            No active notices in this access scope. This is not a safety clearance for every product
            or shipment.
          </p>
        )}
      </section>
      {data.products && data.products.held_count > 0 ? (
        <p role="alert" className="mt-5">
          Material safety holds remain. Review the affected products before further trade; readiness
          advice is paused.
        </p>
      ) : (
        canDo('batch.read') && <ReadinessAssistant />
      )}
      {!metrics.length && (
        <p className="mt-5">
          This account has no readable source or trade summaries. Your access has not been expanded
          by opening this page.
        </p>
      )}
    </Layout>
  );
}
