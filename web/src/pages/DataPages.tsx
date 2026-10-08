import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { audit as auditApi, organizations as organizationsApi } from '../api';
import { AuditEvent } from '../types';
import { StatusBadge } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
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

export {default as PaymentsPage} from './PaymentRecordsPage';

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

export { default as CertsPage } from '../components/catalog/CertificateRecordsPage';

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
