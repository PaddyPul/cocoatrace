import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shipments } from '../api';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Ship, Anchor, Calendar, MapPin, Hash, CheckCircle2, Circle } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

const MILESTONE_ORDER = ['requested','accepted','picked_up','warehouse_received','port_received','loaded','departed','arrived','customs_cleared','delivered'];

const MILESTONE_LABELS: Record<string, string> = {
  requested: 'Shipment Requested',
  accepted: 'Accepted',
  picked_up: 'Picked Up',
  warehouse_received: 'At Warehouse',
  port_received: 'At Port',
  loaded: 'Loaded on Vessel',
  departed: 'Departed',
  arrived: 'Arrived at Destination',
  customs_cleared: 'Customs Cleared',
  delivered: 'Delivered',
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ shipment: any; milestones: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    shipments.get(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout currentPage="shipments"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="shipments"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const { shipment: s, milestones } = data;
  const currentIdx = MILESTONE_ORDER.indexOf(s.current_milestone);

  return (
    <Layout
      currentPage="shipments"
      actions={<button className="btn btn-sm" onClick={() => navigate('/shipments')}><ArrowLeft size={14} /> Back</button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Shipment info card */}
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold">{s.vessel_name || 'Shipment'}</h1>
                <p className="font-mono text-xs text-text-muted mt-0.5">{s.container_reference || ''}</p>
              </div>
              <StatusBadge status={s.current_milestone} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Origin</div>
                <div className="text-sm font-medium flex items-center gap-1"><MapPin size={14} /> {s.origin_port}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Destination</div>
                <div className="text-sm font-medium flex items-center gap-1"><Anchor size={14} /> {s.destination_port}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">ETA</div>
                <div className="text-sm flex items-center gap-1"><Calendar size={14} /> {fmtDate(s.eta_arrival)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">B/L Number</div>
                <div className="font-mono text-xs flex items-center gap-1"><Hash size={14} /> {s.bill_of_lading_number || '—'}</div>
              </div>
            </div>

            {s.logistics_name && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Logistics Partner</div>
                <div className="text-sm">{s.logistics_name}</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="bg-surface border border-border rounded p-5">
            <h3 className="text-sm font-semibold mb-3">Shipment Progress</h3>
            <div className="progress-bar mb-2">
              <div
                className="progress-fill bg-brand-500"
                style={{ width: `${currentIdx >= 0 ? ((currentIdx + 1) / MILESTONE_ORDER.length) * 100 : 0}%` }}
              />
            </div>
            <div className="text-xs text-text-muted font-mono">
              {currentIdx >= 0 ? MILESTONE_LABELS[s.current_milestone] : 'Not started'}
              {currentIdx >= 0 && ` — ${Math.round(((currentIdx + 1) / MILESTONE_ORDER.length) * 100)}%`}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-surface border border-border rounded p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Ship size={16} className="text-brand-400" />
              Milestone Timeline
            </h3>
            <div className="space-y-0">
              {MILESTONE_ORDER.map((m, i) => {
                const milestone = milestones?.find((ms: any) => ms.milestone === m);
                const isDone = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={m} className="flex gap-3">
                    <div className="flex flex-col items-center w-6 shrink-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        isDone ? 'bg-brand-500 text-white' : isCurrent ? 'bg-yellow-900/30 border border-yellow-500' : 'bg-surface-darker border border-border-strong'
                      }`}>
                        {isDone ? '✓' : isCurrent ? '◉' : '○'}
                      </div>
                      {i < MILESTONE_ORDER.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[24px] ${isDone ? 'bg-brand-500' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`pb-4 flex-1 ${isCurrent ? '' : ''}`}>
                      <div className={`text-sm ${isDone ? 'text-text-primary font-medium' : isCurrent ? 'text-yellow-400 font-medium' : 'text-text-muted'}`}>
                        {MILESTONE_LABELS[m]}
                      </div>
                      {milestone && (
                        <div className="text-[11px] text-text-muted mt-0.5 space-y-0.5">
                          {milestone.location && <div>📍 {milestone.location}</div>}
                          {milestone.notes && <div className="italic">{milestone.notes}</div>}
                          <div className="font-mono text-[10px]">{new Date(milestone.recorded_at).toLocaleString()}</div>
                        </div>
                      )}
                      {!milestone && isCurrent && (
                        <div className="text-[11px] text-text-muted italic mt-0.5">Awaiting update…</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Quick Actions</h4>
            <div className="space-y-2">
              <button className="btn w-full justify-center text-xs">
                <MapPin size={14} /> Track Live
              </button>
              <button className="btn w-full justify-center text-xs">
                <Hash size={14} /> View B/L Document
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
