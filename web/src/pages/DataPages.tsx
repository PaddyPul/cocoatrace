import { useState, useEffect } from 'react';
import { farms as farmsApi, batches as batchesApi, contracts as contractsApi, shipments as shipmentsApi, holdings as holdingsApi, payments as paymentsApi, evidence as evidenceApi, audit as auditApi } from '../api';
import { Farm, Batch, Contract, Shipment, Holding, Payment, Evidence, AuditEvent } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';

function useFetch<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    fetcher()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
}

function Empty() {
  return <tr><td colSpan={99} className="text-center py-8 text-text-muted">No data</td></tr>;
}

export function FarmsPage() {
  const { data, loading, error } = useFetch(() => farmsApi.list());
  return <Layout currentPage="farms">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Region</th><th>Country</th><th>District</th><th>COCOBOD ID</th><th>Status</th></tr></thead><tbody>{(data as Farm[]).map((f) => <tr key={f.id}><td className="text-text-primary font-medium">{f.name}</td><td>{f.region}</td><td>{f.country}</td><td>{f.district}</td><td className="font-mono text-[11px]">{f.official_traceability_id || '—'}</td><td><StatusBadge status={f.verification_status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function BatchesPage() {
  const { data, loading, error } = useFetch(() => batchesApi.list());
  return <Layout currentPage="batches">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Batch ID</th><th>Farm</th><th>Harvest Date</th><th>Qty (kg)</th><th>Grade</th><th>Status</th></tr></thead><tbody>{(data as Batch[]).map((b) => <tr key={b.id}><td className="font-mono text-[11px]">{b.id.slice(0, 13)}…</td><td className="text-text-primary font-medium">{b.farm_name || '—'}</td><td>{fmtDate(b.harvest_date)}</td><td>{(b.quantity_kg || 0).toLocaleString()}</td><td>{b.grade || '—'}</td><td><StatusBadge status={b.organic_claim_status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function HoldingsPage() {
  const { data, loading, error } = useFetch(() => holdingsApi.list());
  return <Layout currentPage="holdings">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Batch</th><th>Crop</th><th>Qty (kg)</th><th>Warehouse</th><th>Status</th></tr></thead><tbody>{(data as Holding[]).map((h) => <tr key={h.id}><td className="font-mono text-[11px]">{h.id.slice(0, 13)}…</td><td className="font-mono text-[11px]">{h.batch_id.slice(0, 8)}…</td><td>{h.crop || 'cocoa'}</td><td>{(h.quantity_kg || 0).toLocaleString()}</td><td className="text-[11px]">{h.warehouse_location || '—'}</td><td><StatusBadge status={h.status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function ContractsPage() {
  const { data, loading, error } = useFetch(() => contractsApi.list());
  return <Layout currentPage="contracts">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Contract</th><th>Seller</th><th>Buyer</th><th>Qty (kg)</th><th>Value</th><th>Incoterm</th><th>Status</th></tr></thead><tbody>{(data as Contract[]).map((c) => <tr key={c.id}><td className="font-mono text-[11px]">{c.id.slice(0, 8)}…</td><td>{c.seller_name || '—'}</td><td className="text-text-primary font-medium">{c.buyer_name || '—'}</td><td>{(c.quantity_kg || 0).toLocaleString()}</td><td className="text-brand-400">€{Math.round(c.quantity_kg * c.price_per_kg).toLocaleString()}</td><td className="font-mono text-[11px]">{c.incoterm}</td><td><StatusBadge status={c.status} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function ShipmentsPage() {
  const { data, loading, error } = useFetch(() => shipmentsApi.list());
  return <Layout currentPage="shipments">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Vessel</th><th>Container</th><th>Route</th><th>ETA</th><th>B/L</th><th>Milestone</th></tr></thead><tbody>{(data as Shipment[]).map((s) => <tr key={s.id}><td className="text-text-primary font-medium">{s.vessel_name || 'Shipment'}</td><td className="font-mono text-[11px]">{s.container_reference || '—'}</td><td className="text-[11px]">{s.origin_port} → {s.destination_port}</td><td>{fmtDate(s.eta_arrival)}</td><td className="font-mono text-[11px]">{s.bill_of_lading_number || '—'}</td><td><StatusBadge status={s.current_milestone} /></td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function PaymentsPage() {
  const { data, loading, error } = useFetch(() => paymentsApi.list());
  return <Layout currentPage="payments">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Payment ID</th><th>Contract</th><th>Amount</th><th>Currency</th><th>Status</th><th>Reference</th></tr></thead><tbody>{(data as Payment[]).map((p) => <tr key={p.id}><td className="font-mono text-[11px]">{p.id.slice(0, 8)}…</td><td className="font-mono text-[11px]">{p.contract_id.slice(0, 8)}…</td><td className="text-brand-400 font-mono">{fmtMoney(p.amount_total, p.currency)}</td><td>{p.currency}</td><td><StatusBadge status={p.status} /></td><td className="font-mono text-[10px]">{p.payment_reference_external || '—'}</td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function EvidencePage() {
  const { data, loading, error } = useFetch(() => evidenceApi.list());
  return <Layout currentPage="evidence">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>File</th><th>Type</th><th>SHA-256</th><th>Linked Entity</th><th>Status</th><th>Uploaded</th></tr></thead><tbody>{(data as Evidence[]).map((e) => <tr key={e.id}><td className="text-text-primary font-medium">{e.file_name}</td><td>{e.type.replace(/_/g, ' ')}</td><td className="font-mono text-[10px] max-w-[200px] truncate">{e.sha256_hash}</td><td className="font-mono text-[10px]">{e.linked_entity_type}/{e.linked_entity_id.slice(0, 8)}…</td><td><StatusBadge status={e.review_status} /></td><td className="text-[11px]">{fmtDate(e.created_at)}</td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function AuditPage() {
  const { data, loading, error } = useFetch(() => auditApi.list());
  return <Layout currentPage="audit">{loading ? <Loading /> : error ? <Err msg={error} /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Hash</th></tr></thead><tbody>{(data as AuditEvent[]).map((a) => <tr key={a.id}><td className="font-mono text-[10px] whitespace-nowrap">{new Date(a.occurred_at).toLocaleString()}</td><td><span className="badge badge-blue">{a.action}</span></td><td className="font-mono text-[10px]">{a.entity_type}/{a.entity_id.slice(0, 8)}</td><td className="text-[11px]">{a.actor_user_id.slice(0, 8)}…</td><td className="font-mono text-[10px]">{(a.new_state_hash || '').slice(0, 20)}…</td></tr>)}{data.length === 0 && <Empty />}</tbody></table></div>}</Layout>;
}

export function CertsPage() {
  return <Layout currentPage="certs"><div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">Certificates</div><p className="text-xs text-text-muted mt-1">Certificate management coming soon</p></div></Layout>;
}

function Loading() {
  return <div className="loading"><div className="spinner" /><div>Loading…</div></div>;
}

function Err({ msg }: { msg: string }) {
  return <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{msg}</div>;
}
