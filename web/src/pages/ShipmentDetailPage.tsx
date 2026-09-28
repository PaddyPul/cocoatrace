import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shipments } from '../api';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Calendar, ExternalLink, FileText, MapPin, Plus, Ship, X } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

const MILESTONES = ['planning', 'booked', 'cargo_ready', 'handed_over', 'loaded', 'departed', 'arrived', 'customs_cleared', 'delivered'];
const LABELS: Record<string, string> = {
  planning: 'Planning', booked: 'Transport Booked', cargo_ready: 'Cargo Ready',
  handed_over: 'Handed to Transport Provider', loaded: 'Loaded / Dispatched',
  departed: 'Departed Origin', arrived: 'Arrived at Destination',
  customs_cleared: 'Customs / Border Cleared', delivered: 'Delivered',
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [data, setData] = useState<{ shipment: any; milestones: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState<any>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const [showMilestone, setShowMilestone] = useState(false);
  const [milestone, setMilestone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');

  const refresh = async () => {
    if (!id) return;
    setData(await shipments.get(id));
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout currentPage="shipments"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="shipments"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const { shipment: s, milestones } = data;
  const isCoordinator = s.transport_coordinator_organization_id === user?.organizationId;
  const currentIndex = MILESTONES.indexOf(s.current_milestone);
  const availableMilestones = MILESTONES.filter((_, index) => index > currentIndex);

  const openDetails = () => {
    setDetails({
      serviceProviderName: s.service_provider_name || '', bookingReference: s.booking_reference || '',
      transportMode: s.transport_mode || 'unspecified', transportDocumentType: s.transport_document_type || '',
      transportDocumentReference: s.transport_document_reference || '', trackingUrl: s.tracking_url || '',
      vesselName: s.vessel_name || '', containerReference: s.container_reference || '',
      originLocation: s.origin_port || '', destinationLocation: s.destination_port || '',
      etaArrival: s.eta_arrival ? String(s.eta_arrival).slice(0, 10) : '',
    });
    setDetailsError(''); setShowDetails(true);
  };

  const saveDetails = async () => {
    if (!id) return;
    if (!details.serviceProviderName && !details.bookingReference) { setDetailsError('Enter the provider name or booking reference'); return; }
    setDetailsLoading(true); setDetailsError('');
    try {
      const payload = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== ''));
      await shipments.updateDetails(id, payload);
      await refresh(); setShowDetails(false);
      toast('success', 'Transport arrangement updated');
    } catch (e: any) { setDetailsError(e.message); } finally { setDetailsLoading(false); }
  };

  const recordMilestone = async () => {
    if (!id || !milestone) { setMilestoneError('Select a milestone'); return; }
    setMilestoneLoading(true); setMilestoneError('');
    try {
      await shipments.recordMilestone(id, { milestone, location: location || undefined, notes: notes || undefined });
      await refresh(); setShowMilestone(false); setMilestone(''); setLocation(''); setNotes('');
      toast('success', 'Transport progress recorded');
    } catch (e: any) { setMilestoneError(e.message); } finally { setMilestoneLoading(false); }
  };

  return <Layout currentPage="shipments" actions={<button className="btn btn-sm" onClick={() => navigate('/shipments')}><ArrowLeft size={14} /> Back</button>}>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-brand-500/10 border border-brand-500/30 rounded p-4 text-xs leading-5">
          <div className="font-semibold text-brand-400">Buyer–seller managed transport</div>
          <div className="text-text-muted">{s.transport_coordinator_name} coordinates transport under {s.incoterm}. External providers do not need a CocoaTrace account; the parties record information received from their provider.</div>
        </div>

        <div className="bg-surface border border-border rounded p-5">
          <div className="flex items-start justify-between mb-5"><div><h1 className="text-lg font-bold">Transport Arrangement</h1><p className="font-mono text-xs text-text-muted mt-0.5">{s.id}</p></div><StatusBadge status={s.current_milestone} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Coordinator" value={s.transport_coordinator_name} />
            <Field label="External provider" value={s.service_provider_name || 'Not recorded'} />
            <Field label="Mode" value={s.transport_mode === 'unspecified' ? 'Not selected' : pretty(s.transport_mode)} />
            <Field label="Booking reference" value={s.booking_reference || 'Not recorded'} mono />
            <Field label="Transport document" value={s.transport_document_reference || 'Not issued'} mono />
            <Field label="ETA" value={fmtDate(s.eta_arrival)} />
            <Field label="Origin" value={s.origin_port} />
            <Field label="Destination" value={s.destination_port} />
            {(s.vessel_name || s.container_reference) && <Field label="Vessel / equipment" value={[s.vessel_name, s.container_reference].filter(Boolean).join(' · ')} />}
          </div>
          {s.tracking_url && <a className="btn btn-sm mt-4" href={s.tracking_url} target="_blank" rel="noreferrer">Open provider tracking <ExternalLink size={13} /></a>}
          <button className="btn btn-sm mt-4 ml-2" onClick={() => navigate(`/contracts/${s.contract_id}`)}><FileText size={13} /> View contract</button>
        </div>

        <div className="bg-surface border border-border rounded p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Ship size={16} className="text-brand-400" /> Transport progress</h3>
          <div className="space-y-0">{MILESTONES.map((item, index) => {
            const event = milestones.find((entry: any) => entry.milestone === item);
            const done = index <= currentIndex;
            return <div key={item} className="flex gap-3"><div className="flex flex-col items-center w-6 shrink-0"><div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${done ? 'bg-brand-500 text-white' : 'bg-surface-darker border border-border-strong'}`}>{done ? '✓' : '○'}</div>{index < MILESTONES.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] ${done ? 'bg-brand-500' : 'bg-border'}`} />}</div><div className="pb-4 flex-1"><div className={`text-sm ${done ? 'text-text-primary font-medium' : 'text-text-muted'}`}>{LABELS[item]}</div>{event && <div className="text-[11px] text-text-muted mt-1">{event.location && <div><MapPin size={11} className="inline" /> {event.location}</div>}{event.notes && <div>{event.notes}</div>}<div>{event.recorded_by_organization_name} · {new Date(event.recorded_at).toLocaleString()}</div></div>}</div></div>;
          })}</div>
        </div>
      </div>

      <div><div className="bg-surface border border-border rounded p-5 sticky top-6"><h4 className="text-xs font-semibold mb-3">Transport actions</h4><div className="space-y-2">
        {isCoordinator && <button className="btn btn-primary w-full justify-center text-xs" onClick={openDetails}><Ship size={14} /> {s.service_provider_name ? 'Update arrangement' : 'Add arrangement'}</button>}
        {canDo('shipment.update') && s.current_milestone !== 'delivered' && <button className="btn w-full justify-center text-xs" onClick={() => setShowMilestone(true)}><Plus size={14} /> Record progress</button>}
        {!isCoordinator && <p className="text-[10px] text-text-muted leading-4 pt-2">Only {s.transport_coordinator_name} can edit provider and booking details. Both contract parties can report auditable progress.</p>}
      </div></div></div>
    </div>

    {showDetails && <Modal title="External Transport Arrangement" onClose={() => !detailsLoading && setShowDetails(false)}><div className="space-y-3">
      <p className="text-[11px] text-text-muted">Enter information supplied by any freight forwarder, shipping line, haulier, rail operator or other provider. No provider account or integration is required.</p>
      <div className="grid grid-cols-2 gap-3"><Input label="Provider name" value={details.serviceProviderName} onChange={(value) => setDetails({ ...details, serviceProviderName: value })} /><Input label="Booking reference" value={details.bookingReference} onChange={(value) => setDetails({ ...details, bookingReference: value })} />
      <div><label className="form-label">Transport mode</label><select className="form-select" value={details.transportMode} onChange={(e) => setDetails({ ...details, transportMode: e.target.value })}><option value="unspecified">Select mode</option><option value="road">Road</option><option value="rail">Rail</option><option value="sea">Sea</option><option value="air">Air</option><option value="inland_waterway">Inland waterway</option><option value="multimodal">Multimodal</option></select></div>
      <div><label className="form-label">Transport document</label><select className="form-select" value={details.transportDocumentType} onChange={(e) => setDetails({ ...details, transportDocumentType: e.target.value })}><option value="">Select document</option><option value="bill_of_lading">Bill of lading</option><option value="sea_waybill">Sea waybill</option><option value="air_waybill">Air waybill</option><option value="road_consignment_note">Road consignment note</option><option value="rail_consignment_note">Rail consignment note</option><option value="warehouse_release">Warehouse release</option><option value="other">Other</option></select></div>
      <Input label="Document reference" value={details.transportDocumentReference} onChange={(value) => setDetails({ ...details, transportDocumentReference: value })} /><Input label="Tracking URL" value={details.trackingUrl} onChange={(value) => setDetails({ ...details, trackingUrl: value })} />
      <Input label="Origin" value={details.originLocation} onChange={(value) => setDetails({ ...details, originLocation: value })} /><Input label="Destination" value={details.destinationLocation} onChange={(value) => setDetails({ ...details, destinationLocation: value })} />
      <Input label="Vessel / vehicle (optional)" value={details.vesselName} onChange={(value) => setDetails({ ...details, vesselName: value })} /><Input label="Container / equipment (optional)" value={details.containerReference} onChange={(value) => setDetails({ ...details, containerReference: value })} />
      <div className="col-span-2"><label className="form-label">Estimated arrival</label><input type="date" className="form-input" value={details.etaArrival} onChange={(e) => setDetails({ ...details, etaArrival: e.target.value })} /></div></div>
      <ErrorBox message={detailsError} /><Buttons busy={detailsLoading} onCancel={() => setShowDetails(false)} onConfirm={saveDetails} label="Save arrangement" />
    </div></Modal>}

    {showMilestone && <Modal title="Record Transport Progress" onClose={() => !milestoneLoading && setShowMilestone(false)}><div className="space-y-3"><div><label className="form-label">Milestone</label><select className="form-select" value={milestone} onChange={(e) => setMilestone(e.target.value)}><option value="">Select next milestone</option>{availableMilestones.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></div><Input label="Location (optional)" value={location} onChange={setLocation} icon={<MapPin size={12} />} /><div><label className="form-label">Notes (optional)</label><textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div><ErrorBox message={milestoneError} /><Buttons busy={milestoneLoading} onCancel={() => setShowMilestone(false)} onConfirm={recordMilestone} label="Record progress" /></div></Modal>}
  </Layout>;
}

function pretty(value: string) { return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div><div className={`text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</div></div>; }
function Input({ label, value, onChange, icon }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode }) { return <div><label className="form-label">{icon} {label}</label><input className="form-input" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-overlay" onClick={onClose}><div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between mb-3"><div className="modal-title">{title}</div><button className="btn btn-sm" onClick={onClose}><X size={14} /></button></div>{children}</div></div>; }
function ErrorBox({ message }: { message: string }) { return message ? <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{message}</div> : null; }
function Buttons({ busy, onCancel, onConfirm, label }: { busy: boolean; onCancel: () => void; onConfirm: () => void; label: string }) { return <div className="flex gap-2"><button className="btn flex-1 justify-center" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn btn-primary flex-1 justify-center" onClick={onConfirm} disabled={busy}>{busy ? 'Saving…' : label}</button></div>; }
