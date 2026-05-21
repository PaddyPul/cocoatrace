import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { contracts, shipments } from '../api';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, FileText, Ship, Euro, MapPin, Hash, ChevronRight, Tag } from 'lucide-react';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { X } from 'lucide-react';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Shipment request
  const [showShipReq, setShowShipReq] = useState(false);
  const [srVessel, setSrVessel] = useState('');
  const [srContainer, setSrContainer] = useState('');
  const [srOrigin, setSrOrigin] = useState('Tema Port, Ghana');
  const [srDest, setSrDest] = useState('Port of Rotterdam, Netherlands');
  const [srEta, setSrEta] = useState('');
  const [srLoading, setSrLoading] = useState(false);
  const [srError, setSrError] = useState('');
  const [srDone, setSrDone] = useState(false);

  // Payment request
  const [showPayReq, setShowPayReq] = useState(false);
  const [prAmount, setPrAmount] = useState(0);
  const [prCurrency, setPrCurrency] = useState('EUR');
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState('');
  const [prDone, setPrDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    contracts.get(id)
      .then((d) => {
        setData(d);
        if (d.quantity_kg && d.price_per_kg) setPrAmount(d.quantity_kg * d.price_per_kg);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const isSeller = data && user && data.seller_organization_id === user.organizationId;
  const isBuyer = data && user && data.buyer_organization_id === user.organizationId;

  const handleShipRequest = async () => {
    if (!id) return;
    setSrLoading(true); setSrError('');
    try {
      await contracts.requestShipment(id, { vesselName: srVessel || undefined, containerReference: srContainer || undefined, originPort: srOrigin, destinationPort: srDest, etaArrival: srEta || undefined });
      setSrDone(true);
    } catch (e: any) { setSrError(e.message); } finally { setSrLoading(false); }
  };

  const handlePayRequest = async () => {
    if (!id || !prAmount) { setPrError('Amount required'); return; }
    setPrLoading(true); setPrError('');
    try {
      await contracts.requestPayment(id, { amountTotal: Number(prAmount), currency: prCurrency });
      setPrDone(true);
    } catch (e: any) { setPrError(e.message); } finally { setPrLoading(false); }
  };

  if (loading) return <Layout currentPage="contracts"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="contracts"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const c = data;
  const totalValue = (c.quantity_kg || 0) * (c.price_per_kg || 0);

  return (
    <Layout
      currentPage="contracts"
      actions={<button className="btn btn-sm" onClick={() => navigate('/contracts')}><ArrowLeft size={14} /> Back</button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold">Sales Contract</h1>
                <p className="font-mono text-xs text-text-muted mt-0.5">{c.id}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Seller</div>
                <div className="text-sm font-medium">{c.seller_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Buyer</div>
                <div className="text-sm font-medium">{c.buyer_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</div>
                <div className="text-lg font-mono">{(c.quantity_kg || 0).toLocaleString()} kg</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price</div>
                <div className="text-lg font-mono text-brand-400">€{Number(c.price_per_kg).toFixed(2)}/kg</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Value</div>
                <div className="text-xl font-bold font-mono text-brand-400">{fmtMoney(totalValue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Incoterm</div>
                <div className="text-sm font-mono">{c.incoterm}</div>
              </div>
              {c.eudr_due_diligence_reference && (
                <div className="col-span-2">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">EUDR Reference</div>
                  <div className="font-mono text-xs text-text-muted">{c.eudr_due_diligence_reference}</div>
                </div>
              )}
            </div>
          </div>

          {c.listing_id && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Tag size={16} className="text-brand-400" />
                Source Listing
              </h3>
              <p className="text-xs text-text-muted mb-3">Listing {c.listing_id.slice(0, 8)}…</p>
              <button className="btn btn-sm" onClick={() => navigate(`/listing/${c.listing_id}`)}>View Listing <ChevronRight size={14} /></button>
            </div>
          )}

          {c.shipment_id && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Ship size={16} className="text-brand-400" />
                Linked Shipment
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Vessel</div>
                  <div className="text-sm">{c.vessel_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Container</div>
                  <div className="font-mono text-xs">{c.container_reference || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">ETA</div>
                  <div className="text-sm">{fmtDate(c.eta_arrival)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div>
                  <StatusBadge status={c.current_milestone} />
                </div>
              </div>
              <button className="btn btn-sm mt-4" onClick={() => navigate(`/shipments/${c.shipment_id}`)}>
                View Shipment Details <ChevronRight size={14} />
              </button>
            </div>
          )}



          {!c.shipment_id && srDone && (
            <div className="bg-surface border border-border rounded p-5 text-center">
              <div className="text-2xl mb-2">🚢</div>
              <div className="text-sm font-semibold text-brand-400 mb-1">Shipment Requested!</div>
              <p className="text-xs text-text-muted">The logistics provider will pick up the cargo.</p>
            </div>
          )}

          {prDone && (
            <div className="bg-surface border border-border rounded p-5 text-center">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-sm font-semibold text-brand-400 mb-1">Payment Requested!</div>
              <p className="text-xs text-text-muted">The buyer has been notified to complete payment.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <h4 className="text-xs font-semibold mb-3">Quick Actions</h4>
            <div className="space-y-2">
              {canDo('contract.read') && (
                <button className="btn w-full justify-center text-xs">
                  <FileText size={14} /> Download Contract
                </button>
              )}

              {isSeller && !c.shipment_id && !srDone && (
                <button className="btn w-full justify-center text-xs" onClick={() => setShowShipReq(true)}>
                  <Ship size={14} /> Request Shipment
                </button>
              )}

              {isSeller && !prDone && (
                <button className="btn w-full justify-center text-xs" onClick={() => setShowPayReq(true)}>
                  <Euro size={14} /> Request Payment
                </button>
              )}

              {c.shipment_id && (
                <button className="btn w-full justify-center text-xs" onClick={() => navigate(`/shipments/${c.shipment_id}`)}>
                  <Ship size={14} /> Track Shipment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showShipReq && (
        <div className="modal-overlay" onClick={() => !srLoading && setShowShipReq(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div><div className="modal-title">Request Shipment</div></div>
              <button className="btn btn-sm" onClick={() => setShowShipReq(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="form-label">Vessel Name</label>
                  <input className="form-input" placeholder="e.g. MV Cocoa Voyager" value={srVessel} onChange={(e) => setSrVessel(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Container Reference</label>
                  <input className="form-input" placeholder="e.g. MSCU4823137" value={srContainer} onChange={(e) => setSrContainer(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Origin Port</label>
                  <input className="form-input" value={srOrigin} onChange={(e) => setSrOrigin(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Destination Port</label>
                  <input className="form-input" value={srDest} onChange={(e) => setSrDest(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="form-label">ETA</label>
                  <input type="date" className="form-input" value={srEta} onChange={(e) => setSrEta(e.target.value)} />
                </div>
              </div>
              {srError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{srError}</div>}
              <div className="flex gap-2 pt-1">
                <button className="btn flex-1 justify-center" onClick={() => setShowShipReq(false)} disabled={srLoading}>Cancel</button>
                <button className="btn btn-primary flex-1 justify-center" onClick={handleShipRequest} disabled={srLoading}>
                  {srLoading ? 'Requesting…' : 'Request Shipment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayReq && (
        <div className="modal-overlay" onClick={() => !prLoading && setShowPayReq(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div><div className="modal-title">Request Payment</div></div>
              <button className="btn btn-sm" onClick={() => setShowPayReq(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="form-label">Amount</label>
                  <input type="number" step="0.01" className="form-input" value={prAmount || ''} onChange={(e) => setPrAmount(Number(e.target.value))} />
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={prCurrency} onChange={(e) => setPrCurrency(e.target.value)}>
                    <option>EUR</option><option>USD</option><option>GBP</option>
                  </select>
                </div>
              </div>
              {prError && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{prError}</div>}
              <div className="flex gap-2 pt-1">
                <button className="btn flex-1 justify-center" onClick={() => setShowPayReq(false)} disabled={prLoading}>Cancel</button>
                <button className="btn btn-primary flex-1 justify-center" onClick={handlePayRequest} disabled={prLoading || !prAmount}>
                  {prLoading ? 'Requesting…' : 'Request Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
