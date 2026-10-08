import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farms as farmsApi, batches as batchesApi, holdings as holdingsApi, payments as paymentsApi, audit as auditApi, certificates as certApi, organizations as organizationsApi } from '../api';
import { Farm, Batch, Holding, Payment, AuditEvent, Certificate } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import FarmPicker from '../components/catalog/FarmPicker';
import { Search, X } from 'lucide-react';

function useFetch<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const doFetch = () => {
    setLoading(true); setError('');
    return fetcher().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { doFetch(); }, []);
  return { data, loading, error, refetch: doFetch };
}

function Loading() { return <div className="loading"><div className="spinner" /><div>Loading…</div></div>; }
function Err({ msg }: { msg: string }) { return <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{msg}</div>; }

export {default as HoldingsPage} from './InventoryPage';
export {default as FarmsPage} from './SourceFarmsPage';
export {default as BatchesPage} from './SourceBatchesPage';

export {default as ContractsPage} from './ContractRecordsPage';

export {default as ShipmentsPage} from './ShipmentRecordsPage';

export function PaymentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => paymentsApi.list());
  const [search, setSearch] = useState('');
  const payments = data as Payment[];
  const filtered = payments.filter((p) => !search || p.status.toLowerCase().includes(search.toLowerCase()) || p.currency.toLowerCase().includes(search.toLowerCase()) || (p.payment_reference_external || '').toLowerCase().includes(search.toLowerCase()) || p.contract_id.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="payments">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search payments…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} payment{filtered.length !== 1 ? 's' : ''}</div>
    </div>
    <table><thead><tr><th>Payment ID</th><th>Contract</th><th>Amount</th><th>Currency</th><th>Status</th><th>Reference</th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/payments/${p.id}`)}><td className="font-mono text-[11px]">{p.id.slice(0, 8)}…</td><td className="font-mono text-[11px]">{p.contract_id.slice(0, 8)}…</td><td className="text-brand-400 font-mono">{fmtMoney(p.amount_total, p.currency, p.currency_minor_units)}</td><td>{p.currency}</td><td><StatusBadge status={p.status} /></td><td className="font-mono text-[10px]">{p.payment_reference_external || '—'}</td></tr>) : payments.length === 0 ? <tr><td colSpan={99}><EmptyState icon="💰" title="No payment workflows yet" description="A documentary-payment workflow is created automatically when an offer is accepted." action={<button className="btn btn-sm" onClick={() => navigate('/contracts')}>Open Contracts →</button>} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No payments match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export { default as EvidencePage } from './EvidenceRecordsPage';

const AUDIT_ENTITY_ROUTES: Record<string, string> = {
  harvest_batch: '/batches',
  sales_contract: '/contracts',
  shipment: '/shipments',
  payment_request: '/payments',
  trade_offer: '/contracts',
  listing: '/marketplace',
  organic_certificate: '/certs',
  farm: '/farms',
  batch_holding: '/holdings',
  custody_transfer: '/holdings',
  evidence_item: '/evidence',
};

export function AuditPage() {
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { data, loading, error } = useFetch(() => auditApi.list());
  const [search, setSearch] = useState('');
  const events = data as AuditEvent[];
  const filtered = events.filter((a) => !search || a.action.toLowerCase().includes(search.toLowerCase()) || a.entity_type.toLowerCase().includes(search.toLowerCase()) || a.entity_id.toLowerCase().includes(search.toLowerCase()));
  return <Layout currentPage="audit">{loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search audit log…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="text-xs text-text-muted">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</div>
      {canDo('audit.export') && <button className="btn btn-sm" onClick={() => window.open(auditApi.export(), '_blank')}>Export</button>}
    </div>
    <table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Hash</th><th></th></tr></thead><tbody>{filtered.map((a) => {
    const route = AUDIT_ENTITY_ROUTES[a.entity_type];
    return <tr key={a.id} className="hover:bg-brand-500/5">
      <td className="font-mono text-[10px] whitespace-nowrap">{new Date(a.occurred_at).toLocaleString()}</td>
      <td><span className="badge badge-blue">{a.action}</span></td>
      <td className="font-mono text-[10px]">{a.entity_type}/{a.entity_id.slice(0, 8)}</td>
      <td className="text-[11px]">{a.actor_user_id.slice(0, 8)}…</td>
      <td className="font-mono text-[10px]">{(a.new_state_hash || '').slice(0, 20)}…</td>
      <td>{route ? <button className="btn btn-sm text-[10px]" onClick={() => navigate(`${route}`)}>View →</button> : <span className="text-text-muted">—</span>}</td>
    </tr>;
  })}{events.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🔗" title="No audit events" description="Audit events are recorded automatically for all platform actions." /></td></tr> : filtered.length === 0 && <tr><td colSpan={99}><EmptyState icon="🔍" title="No events match" description="Try adjusting your search." /></td></tr>}</tbody></table>
  </div>}</Layout>;
}

export function CertsPage() {
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => certApi.list());
  const [selectedIssueFarm,setSelectedIssueFarm]=useState<Farm|null>(null);
  const [search, setSearch] = useState('');
  const certs = data as Certificate[];
  const filtered = certs.filter((c) => !search || c.standard.toLowerCase().includes(search.toLowerCase()) || c.status.toLowerCase().includes(search.toLowerCase()) || (c.certifier_name || '').toLowerCase().includes(search.toLowerCase()));

  // Issue modal
  const [showIssue, setShowIssue] = useState(false);
  const [ifarmId, setIfarmId] = useState('');
  const [iStandard, setIStandard] = useState('EU_ORGANIC');
  const [iCropScope, setICropScope] = useState('cocoa');
  const [iValidFrom, setIValidFrom] = useState('');
  const [iValidTo, setIValidTo] = useState('');
  const [iAuthority, setIAuthority] = useState('');
  const [iAccred, setIAccred] = useState('');
  const [iLoading, setILoading] = useState(false);
  const [iError, setIError] = useState('');

  const handleIssue = async () => {
    if (!ifarmId || !iValidFrom || !iValidTo || !iAuthority || !iAccred) { setIError('All fields required'); return; }
    setILoading(true); setIError('');
    try {
      const targetFarm = selectedIssueFarm;
      await certApi.issue({
        farmerOrganizationId: targetFarm?.farmer_organization_id || '',
        farmId: ifarmId, standard: iStandard,
        cropScope: iCropScope.split(',').map((s) => s.trim()),
        validFrom: iValidFrom, validTo: iValidTo,
        issuingAuthority: iAuthority, accreditationReference: iAccred,
      });
      setShowIssue(false); setIfarmId(''); setIValidFrom(''); setIValidTo(''); setIAuthority(''); setIAccred('');
      refetch();
      toast('success', 'Certificate issued');
    } catch (e: any) { setIError(e.message); } finally { setILoading(false); }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await certApi.updateStatus(id, action);
      refetch();
      toast('success', `Certificate ${action}ed`);
    } catch (e: any) { toast('error', e.message); }
  };

  return <Layout currentPage="certs">
    {loading ? <SkeletonTable rows={5} cols={6} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Search certificates…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-xs text-text-muted">{filtered.length} certificate{filtered.length !== 1 ? 's' : ''}</div>
        {canDo('certificate.issue') && <button className="btn btn-sm btn-primary" onClick={() => setShowIssue(true)}>+ Issue Certificate</button>}
      </div>
      <table><thead><tr><th>Standard</th><th>Certifier</th><th>Farm</th><th>Valid From</th><th>Valid To</th><th>Status</th><th></th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((c) => <tr key={c.id} className="hover:bg-brand-500/5">
        <td className="text-text-primary font-medium">{c.standard}</td><td>{c.certifier_name || '—'}</td><td className="font-mono text-[11px]">{c.farm_id.slice(0, 8)}…</td><td className="text-[11px]">{fmtDate(c.valid_from)}</td><td className="text-[11px]">{fmtDate(c.valid_to)}</td><td><StatusBadge status={c.status} /></td>
        <td>{canDo('certificate.issue') && c.status === 'active' ? <div className="flex gap-1">
          <button className="btn btn-sm text-[10px] text-yellow-400 border-yellow-500/30" onClick={() => handleAction(c.id, 'suspend')}>Suspend</button>
          <button className="btn btn-sm text-[10px] text-red-400 border-red-500/30" onClick={() => handleAction(c.id, 'revoke')}>Revoke</button>
        </div> : canDo('certificate.issue') && c.status === 'suspended' ? <button className="btn btn-sm text-[10px] text-green-400 border-green-500/30" onClick={() => handleAction(c.id, 'reinstate')}>Reinstate</button> : <button className="btn btn-sm text-[10px]" onClick={() => navigate(`/farms/${c.farm_id}`)}>View Farm</button>}</td>
      </tr>) : certs.length === 0 ? <tr><td colSpan={99}><EmptyState icon="📋" title="No certificates" description="Certificates are issued by accredited certifiers to verified farms." action={canDo('certificate.issue') ? <button className="btn btn-sm btn-primary" onClick={() => setShowIssue(true)}>+ Issue Certificate</button> : undefined} /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No certificates match" description="Try adjusting your search." /></td></tr>}</tbody></table>
    </div>}

    {/* Issue Certificate Modal */}
    {showIssue && (
      <div className="modal-overlay" onClick={() => !iLoading && setShowIssue(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">Issue Certificate</div></div>
            <button className="btn btn-sm" onClick={() => setShowIssue(false)}><X size={14} /></button>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="form-label">Farm *</label>
              <FarmPicker value={ifarmId} disabled={iLoading} onChange={farm=>{setSelectedIssueFarm(farm);setIfarmId(farm?.id||'');}} />
            </div>
            <div>
              <label className="form-label">Standard</label>
              <select className="form-select" value={iStandard} onChange={(e) => setIStandard(e.target.value)}>
                <option value="EU_ORGANIC">EU Organic</option>
                <option value="USDA_ORGANIC">USDA Organic</option>
                <option value="RAINFOREST_ALLIANCE">Rainforest Alliance</option>
                <option value="FAIRTRADE">Fairtrade</option>
                <option value="UTZ">UTZ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Crop Scope</label>
              <input className="form-input" placeholder="cocoa, coffee…" value={iCropScope} onChange={(e) => setICropScope(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Valid From *</label>
                <input type="date" className="form-input" value={iValidFrom} onChange={(e) => setIValidFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Valid To *</label>
                <input type="date" className="form-input" value={iValidTo} onChange={(e) => setIValidTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Issuing Authority *</label>
              <input className="form-input" placeholder="e.g. OrganicCert GH" value={iAuthority} onChange={(e) => setIAuthority(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Accreditation Reference *</label>
              <input className="form-input" placeholder="e.g. OCG-GH-2026-001" value={iAccred} onChange={(e) => setIAccred(e.target.value)} />
            </div>
            {iError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{iError}</div>}
            <div className="flex gap-2 pt-1">
              <button className="btn flex-1 justify-center" onClick={() => setShowIssue(false)} disabled={iLoading}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={handleIssue} disabled={iLoading}>{iLoading ? 'Issuing…' : 'Issue Certificate'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Layout>;
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { data: orgs, loading, error } = useFetch(() => organizationsApi.list());
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const handleViewMembers = async (org: any) => {
    setSelectedOrg(org);
    setMembersLoading(true);
    try {
      const m = await organizationsApi.members(org.id);
      setMembers(m);
    } catch { setMembers([]); } finally { setMembersLoading(false); }
  };

  const filtered = orgs.filter((o: any) => !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.type?.toLowerCase().includes(search.toLowerCase()) || (o.country || '').toLowerCase().includes(search.toLowerCase()));

  return <Layout currentPage="organizations">
    {loading ? <SkeletonTable rows={5} cols={3} /> : error ? <Err msg={error} /> : <div className="table-wrap">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Search organizations…" className="form-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="text-xs text-text-muted">{filtered.length} organization{filtered.length !== 1 ? 's' : ''}</div>
      </div>
      <table><thead><tr><th>Name</th><th>Type</th><th>Country</th><th>Workspace access</th><th></th></tr></thead><tbody>{filtered.length > 0 ? filtered.map((o: any) => <tr key={o.id} className="hover:bg-brand-500/5">
        <td className="text-text-primary font-medium">{o.name}</td>
        <td><span className="badge badge-blue">{o.type}</span></td>
        <td>{o.country || '—'}</td><td>{o.verification_status === 'verified' ? 'Workspace approved' : 'Approval pending'}</td>
        <td><button className="btn btn-sm" onClick={() => handleViewMembers(o)}>Members →</button></td>
      </tr>) : orgs.length === 0 ? <tr><td colSpan={99}><EmptyState icon="🏢" title="No organizations" description="Organizations represent all entities on the platform." /></td></tr> : <tr><td colSpan={99}><EmptyState icon="🔍" title="No organizations match" description="Try adjusting your search." /></td></tr>}</tbody></table>
    </div>}

    {selectedOrg && (
      <div className="modal-overlay" onClick={() => { setSelectedOrg(null); setMembers([]); }}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-2">
            <div><div className="modal-title">{selectedOrg.name} — Members</div></div>
            <button className="btn btn-sm" onClick={() => { setSelectedOrg(null); setMembers([]); }}><X size={14} /></button>
          </div>
          {membersLoading ? <div className="py-4 text-center text-sm text-text-muted">Loading…</div> : members.length === 0 ? <div className="py-4 text-center text-sm text-text-muted">No members</div> : (
            <table className="w-full"><thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead><tbody>{members.map((m: any) => <tr key={m.id}>
              <td className="font-mono text-[11px]">{m.email}</td>
              <td>{m.name || '—'}</td>
              <td><span className="badge badge-blue">{m.role_name || m.role}</span></td>
            </tr>)}</tbody></table>
          )}
        </div>
      </div>
    )}
  </Layout>;
}
