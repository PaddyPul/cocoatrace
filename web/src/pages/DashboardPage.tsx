import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { batches, contracts, shipments, farms, audit, listings } from '../api';
import { Batch, Contract, Shipment, Farm, AuditEvent, Listing } from '../types';
import { StatusBadge, fmtDate, fmtMoney, milePct } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { useAuthCtx } from '../components/auth/AuthProvider';

export default function DashboardPage() {
  const { user, canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgType = user?.orgType;
    setLoading(true);

    const load = async () => {
      try {
        if (['exporter', 'admin'].includes(orgType || '')) {
          const [b, c, s] = await Promise.all([
            batches.list(), contracts.list(), shipments.list(),
          ]);
          setData({ batches: b, contracts: c, shipments: s });
        } else if (orgType === 'farmer') {
          const [f, b] = await Promise.all([farms.list(), batches.list()]);
          setData({ farms: f, batches: b });
        } else if (orgType === 'certifier') {
          const [b, c] = await Promise.all([batches.list(), Promise.resolve([])]);
          setData({ batches: b, certs: c });
        } else if (orgType === 'importer') {
          const [l, c] = await Promise.all([listings.list(), contracts.list()]);
          setData({ listings: l, contracts: c });
        } else if (orgType === 'logistics') {
          const s = await shipments.list();
          setData({ shipments: s });
        } else if (orgType === 'regulator') {
          const a = await audit.list();
          setData({ audit: a });
        } else {
          const [b, c] = await Promise.all([batches.list(), contracts.list()]);
          setData({ batches: b, contracts: c });
        }
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.orgType]);

  const orgType = user?.orgType;

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="loading"><div className="spinner" /><div>Loading dashboard…</div></div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="dashboard">
      {orgType === 'exporter' || orgType === 'admin'
        ? <ExporterDash data={data} navigate={navigate} />
        : orgType === 'farmer'
        ? <FarmerDash data={data} navigate={navigate} />
        : orgType === 'certifier'
        ? <CertifierDash data={data} navigate={navigate} />
        : orgType === 'importer'
        ? <ImporterDash data={data} navigate={navigate} />
        : orgType === 'logistics'
        ? <LogisticsDash data={data} navigate={navigate} />
        : orgType === 'regulator'
        ? <RegulatorDash data={data} navigate={navigate} />
        : <ExporterDash data={data} navigate={navigate} />
      }
    </Layout>
  );
}

function ExporterDash({ data, navigate }: { data: any; navigate: any }) {
  const batches: Batch[] = data.batches || [];
  const contracts: Contract[] = data.contracts || [];
  const shipments: Shipment[] = data.shipments || [];
  const attested = batches.filter((b) => b.organic_claim_status === 'attested').length;
  const inTransit = contracts.filter((c) => c.status === 'in_transit').length;
  const totalVal = contracts.reduce((s, c) => s + c.quantity_kg * c.price_per_kg, 0);
  const pendingPay = contracts.filter((c) => c.status === 'delivered').length;

  return (
    <>
      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 mb-4 text-xs text-yellow-400 flex items-start gap-2">
        <span>⚠</span>
        <span>Certificate OC-GH-2248 expires in 12 days — contact OrganicCert GH to renew.</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card stat-card-accent">
          <div className="stat-label">Total Batches</div>
          <div className="stat-value">{batches.length}</div>
          <div className="text-xs text-text-muted mt-1">{attested} attested</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Contracts</div>
          <div className="stat-value text-yellow-400">{contracts.filter((c) => !['settled', 'cancelled'].includes(c.status)).length}</div>
          <div className="text-xs text-text-muted mt-1">{inTransit} in transit</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Contract Value</div>
          <div className="stat-value text-lg">€{Math.round(totalVal / 1000)}k</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Payment</div>
          <div className={`stat-value ${pendingPay > 0 ? 'text-yellow-400' : 'text-brand-400'}`}>{pendingPay}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold">Recent Batches</h3>
            <button className="btn btn-sm" onClick={() => navigate('/batches')}>View all →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Batch</th><th>Farm</th><th>Qty (kg)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {batches.slice(0, 5).map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{b.id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{b.farm_name || '—'}</td>
                    <td>{(b.quantity_kg || 0).toLocaleString()}</td>
                    <td><StatusBadge status={b.organic_claim_status} /></td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-5 text-text-muted">No batches yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold">Recent Contracts</h3>
            <button className="btn btn-sm" onClick={() => navigate('/contracts')}>View all →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Contract</th><th>Buyer</th><th>Value</th><th>Status</th></tr>
              </thead>
              <tbody>
                {contracts.slice(0, 5).map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-brand-500/5">
                    <td className="font-mono text-[11px]">{c.id.slice(0, 8)}…</td>
                    <td className="text-text-primary font-medium">{c.buyer_name || '—'}</td>
                    <td>€{Math.round(c.quantity_kg * c.price_per_kg).toLocaleString()}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-5 text-text-muted">No contracts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {shipments.filter((s) => s.current_milestone !== 'delivered').length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold mb-3">Active Shipments</h3>
          <div className="space-y-3">
            {shipments.filter((s) => s.current_milestone !== 'delivered').map((s) => (
              <div key={s.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <strong className="text-sm">{s.vessel_name || 'Shipment'}</strong>
                    <span className="text-text-secondary text-xs ml-2 font-mono">{s.container_reference || ''}</span>
                  </div>
                  <StatusBadge status={s.current_milestone} />
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  {s.origin_port} → {s.destination_port} · ETA {fmtDate(s.eta_arrival)}
                </div>
                <div className="progress-bar">
                  <div className="progress-fill bg-brand-500" style={{ width: `${milePct(s.current_milestone)}%` }} />
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button className="btn btn-sm" onClick={() => navigate('/shipments')}>Track →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FarmerDash({ data, navigate }: { data: any; navigate: any }) {
  const farms: Farm[] = data.farms || [];
  const batches: Batch[] = data.batches || [];
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card stat-card-accent">
          <div className="stat-label">My Farms</div>
          <div className="stat-value">{farms.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Batches</div>
          <div className="stat-value">{batches.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Attested</div>
          <div className="stat-value text-brand-400">{batches.filter((b) => b.organic_claim_status === 'attested').length}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Farm</th><th>Region</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {farms.map((f) => (
              <tr key={f.id}>
                <td className="text-text-primary font-medium">{f.name}</td>
                <td>{f.region}, {f.country}</td>
                <td><StatusBadge status={f.verification_status} /></td>
                <td><button className="btn btn-sm" onClick={() => navigate('/farms')}>View →</button></td>
              </tr>
            ))}
            {farms.length === 0 && (
              <tr><td colSpan={4} className="text-center py-5 text-text-muted">No farms yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CertifierDash({ data, navigate }: { data: any; navigate: any }) {
  const batches: Batch[] = data.batches || [];
  const pending = batches.filter((b) => b.organic_claim_status === 'pending_attestation');
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card stat-card-accent"><div className="stat-label">Awaiting Attestation</div><div className="stat-value text-yellow-400">{pending.length}</div></div>
      </div>
      {pending.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Batch</th><th>Farm</th><th>Harvest Date</th><th>Qty (kg)</th><th>Action</th></tr></thead>
            <tbody>
              {pending.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-[11px]">{b.id.slice(0, 8)}…</td>
                  <td className="text-text-primary font-medium">{b.farm_name || '—'}</td>
                  <td>{fmtDate(b.harvest_date)}</td>
                  <td>{(b.quantity_kg || 0).toLocaleString()}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => navigate('/batches')}>Attest →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-brand-900/10 border border-brand-500/30 rounded-sm px-3 py-2 text-xs text-brand-400">✓ No batches pending attestation.</div>
      )}
    </>
  );
}

function ImporterDash({ data, navigate }: { data: any; navigate: any }) {
  const listings: Listing[] = data.listings || [];
  const contracts: Contract[] = data.contracts || [];
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card stat-card-accent"><div className="stat-label">Available Listings</div><div className="stat-value">{listings.length}</div></div>
        <div className="stat-card"><div className="stat-label">My Contracts</div><div className="stat-value">{contracts.length}</div></div>
        <div className="stat-card"><div className="stat-label">In Transit</div><div className="stat-value text-yellow-400">{contracts.filter((c) => c.status === 'in_transit').length}</div></div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Available Listings</h3>
        <button className="btn btn-sm btn-primary" onClick={() => navigate('/marketplace')}>Browse All →</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Seller</th><th>Region</th><th>Qty (kg)</th><th>Price</th><th>Grade</th><th>Organic</th><th></th></tr></thead>
          <tbody>
            {listings.slice(0, 5).map((l) => (
              <tr key={l.id} className="cursor-pointer hover:bg-brand-500/5" onClick={() => navigate(`/listing/${l.id}`)}>
                <td className="text-text-primary font-medium">{l.seller_name || '—'}</td>
                <td>{l.farm_region || '—'}</td>
                <td>{(l.available_quantity_kg || 0).toLocaleString()}</td>
                <td className="text-brand-400">€{l.price_per_kg}/kg</td>
                <td>{l.grade || '—'}</td>
                <td><StatusBadge status={l.organic_claim_status} /></td>
                <td><button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); navigate(`/listing/${l.id}`); }}>View</button></td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr><td colSpan={7} className="text-center py-5 text-text-muted">No listings available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogisticsDash({ data, navigate }: { data: any; navigate: any }) {
  const shipments: Shipment[] = data.shipments || [];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card stat-card-accent"><div className="stat-label">Active Shipments</div><div className="stat-value">{shipments.filter((s) => s.current_milestone !== 'delivered').length}</div></div>
        <div className="stat-card"><div className="stat-label">Delivered</div><div className="stat-value text-brand-400">{shipments.filter((s) => s.current_milestone === 'delivered').length}</div></div>
      </div>
    </>
  );
}

function RegulatorDash({ data, navigate }: { data: any; navigate: any }) {
  const audit: AuditEvent[] = data.audit || [];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card stat-card-accent"><div className="stat-label">Audit Events (total)</div><div className="stat-value">{audit.length}</div></div>
        <div className="stat-card"><div className="stat-label">Risk Flags</div><div className="stat-value text-yellow-400">3</div></div>
      </div>
      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 mb-4 text-xs text-yellow-400">⚠ 3 farms in Brong-Ahafo region have no COCOBOD traceability ID</div>
      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 mb-4 text-xs text-yellow-400">⚠ Certificate OC-GH-2248 expires in 12 days</div>
    </>
  );
}
