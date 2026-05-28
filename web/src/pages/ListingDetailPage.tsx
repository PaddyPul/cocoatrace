import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listings, provenance as provenanceApi, offers } from '../api';
import { Listing, ProvenancePack } from '../types';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Leaf, Shield, Package, Ship, Euro, ChevronRight, MapPin } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/shared/ToastProvider';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = usePermission();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [provenance, setProvenance] = useState<ProvenancePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Offer state
  const [showOffer, setShowOffer] = useState(false);
  const [offerQty, setOfferQty] = useState(0);
  const [offerPrice, setOfferPrice] = useState(0);
  const [offerNote, setOfferNote] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerDone, setOfferDone] = useState(false);
  const [offerError, setOfferError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      listings.get(id),
      // We could fetch provenance here if needed
    ])
      .then(([l]) => {
        setListing(l);
        setOfferQty(l.available_quantity_kg || 0);
        setOfferPrice(l.price_per_kg || 0);
        // Attempt to load provenance
        if (l.batch_id) {
          provenanceApi.get(l.batch_id).then(setProvenance).catch(() => {});
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOffer = async () => {
    if (!listing) return;
    if (!offerQty || offerQty <= 0) { setOfferError('Quantity must be greater than 0'); return; }
    if (!offerPrice || offerPrice <= 0) { setOfferError('Price must be greater than 0'); return; }
    if (offerQty > (listing.available_quantity_kg || 0)) { setOfferError(`Quantity cannot exceed ${listing.available_quantity_kg} kg`); return; }
    setOfferLoading(true);
    setOfferError('');
    try {
      await offers.create(listing.id, {
        quantityKg: Number(offerQty),
        offeredPricePerKg: Number(offerPrice),
        currency: 'EUR',
      });
      setOfferDone(true);
      toast('success', 'Offer submitted to seller');
    } catch (e: any) {
      setOfferError(e.message);
    } finally {
      setOfferLoading(false);
    }
  };

  if (loading) {
    return <Layout currentPage="listing"><SkeletonDetail /></Layout>;
  }

  if (error || !listing) {
    return (
      <Layout currentPage="listing">
        <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
          {error || 'Listing not found'}
        </div>
      </Layout>
    );
  }

  const batch = provenance?.batch;
  const checks = provenance?.policyCheckResults || [];
  const completeness = provenance?.completenessPercent || 0;
  const eudrReady = provenance?.eudrReadiness?.ready;

  return (
    <Layout
      currentPage="listing"
      actions={
        <button className="btn btn-sm" onClick={() => navigate('/marketplace')}>
          <ArrowLeft size={14} /> Back
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Hero card */}
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="h-48 bg-surface-darker flex items-center justify-center text-6xl relative">
              🫘🌿
              <div className="absolute top-3 right-3 flex gap-2">
                <StatusBadge status={listing.organic_claim_status === 'attested' ? 'organic' : listing.organic_claim_status} />
                {listing.grade && <span className="badge badge-blue">{listing.grade}</span>}
              </div>
            </div>
            <div className="p-5">
              <h1 className="text-xl font-bold text-text-primary mb-1">
                {listing.seller_name || 'Unknown Seller'}
              </h1>
              <p className="text-sm text-text-muted">
                {listing.farm_region || 'Unknown region'}
                {listing.origin_location ? ` · ${listing.origin_location}` : ''}
              </p>

              <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price</div>
                  <div className="text-2xl font-bold font-mono text-brand-400">
                    €{listing.price_per_kg}
                    <span className="text-xs text-text-muted font-normal">/kg</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Available</div>
                  <div className="text-2xl font-bold font-mono">
                    {(listing.available_quantity_kg || 0).toLocaleString()} kg
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Incoterm</div>
                  <div className="text-lg font-bold font-mono">{listing.incoterm}</div>
                </div>
              </div>

              {/* Total price calculator (beforward.jp style) */}
              <div className="mt-5 p-4 bg-surface-darker border border-border rounded">
                <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Euro size={14} /> Total Price Calculator
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="form-label">Quantity (kg)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={offerQty}
                      onChange={(e) => setOfferQty(Number(e.target.value))}
                      max={listing.available_quantity_kg}
                    />
                  </div>
                  <div>
                    <label className="form-label">Price per kg (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-text-muted">Estimated total</span>
                  <span className="text-lg font-bold font-mono text-brand-400">
                    {fmtMoney(offerQty * offerPrice)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Batch provenance pack */}
          {batch && (
            <div className="bg-surface border border-border rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield size={16} className="text-brand-400" />
                  Provenance Pack
                </h3>
                <div className="flex gap-2">
                  <span className={`badge ${completeness >= 95 ? 'badge-green' : 'badge-amber'}`}>
                    {completeness}% complete
                  </span>
                  <span className={`badge ${eudrReady ? 'badge-green' : 'badge-amber'}`}>
                    EUDR: {eudrReady ? 'Ready' : 'Incomplete'}
                  </span>
                </div>
              </div>

              {!eudrReady && (
                <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-sm px-3 py-2 mb-4 text-xs text-yellow-400 flex items-start gap-2">
                  <span>⚠</span>
                  <span>EUDR due-diligence reference missing. Required before EU customs clearance.</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Batch ID</div>
                  <div className="font-mono text-xs text-text-secondary break-all">
                    {batch.id?.slice(0, 18)}…
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Farm</div>
                  <div className="text-sm">{batch.farm_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Region</div>
                  <div className="text-sm">{batch.region}{batch.country ? `, ${batch.country}` : ''}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Harvest Date</div>
                  <div className="text-sm">{fmtDate(batch.harvest_date)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Crop</div>
                  <div className="text-sm">{batch.crop}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Grade</div>
                  <div className="text-sm">{batch.grade || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Certificate</div>
                  <div className="text-sm">{batch.standard || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Certifier</div>
                  <div className="text-sm">{batch.certifier_name || '—'}</div>
                </div>
              </div>

              {batch.att_hash && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Provenance Hash</div>
                  <div className="font-mono text-[10px] text-text-muted break-all">{batch.att_hash}</div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border flex gap-2">
                {batch.id && <button className="btn btn-sm text-xs" onClick={() => navigate(`/batches/${batch.id}`)}>View Batch <ChevronRight size={14} /></button>}
                {listing.farm_name && <button className="btn btn-sm text-xs" onClick={() => navigate(`/farms/${batch.farm_id || ''}`)}><MapPin size={14} /> View Farm</button>}
              </div>

              {/* Policy checks */}
              {checks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Policy Checks</div>
                  <div className="space-y-1">
                    {checks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span>{c.passed ? '✅' : c.warning ? '⚠️' : '❌'}</span>
                        <span className={c.passed ? 'text-text-secondary' : c.warning ? 'text-yellow-400' : 'text-red-400'}>
                          {c.rule}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Purchase flow steps (beforward.jp style) */}
          <div className="bg-surface border border-border rounded p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Package size={16} className="text-brand-400" />
              Purchase Flow
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { step: 1, label: 'Make Offer', icon: '📝' },
                { step: 2, label: 'Contract', icon: '📄' },
                { step: 3, label: 'Payment', icon: '💰' },
                { step: 4, label: 'Shipment', icon: '🚢' },
              ].map((s) => (
                <div key={s.step} className="text-center p-3 bg-surface-darker rounded border border-border">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-[10px] text-text-muted uppercase">Step {s.step}</div>
                  <div className="text-xs font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: action panel */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-2xl font-bold font-mono text-brand-400 mb-1">
              €{listing.price_per_kg}
              <span className="text-xs text-text-muted font-normal">/kg</span>
            </div>
            <div className="text-sm text-text-secondary mb-4">
              {(listing.available_quantity_kg || 0).toLocaleString()} kg available
            </div>

            {!showOffer && !offerDone && canDo('offer.create') && (
              <>
                <button
                  className="btn btn-primary w-full justify-center mb-2"
                  onClick={() => setShowOffer(true)}
                >
                  Make Offer
                </button>
                <button
                  className="btn w-full justify-center text-xs"
                  onClick={() => {
                    setOfferQty(listing.available_quantity_kg || 0);
                    setOfferPrice(listing.price_per_kg || 0);
                    setShowOffer(true);
                  }}
                >
                  Buy Now
                </button>
              </>
            )}

            {offerDone && (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-sm font-semibold text-brand-400">Offer Submitted!</div>
                <p className="text-xs text-text-muted mt-1">
                  The seller will review your offer. Check your contracts for updates.
                </p>
                <button
                  className="btn btn-sm mt-3"
                  onClick={() => navigate('/contracts')}
                >
                  View Contracts <ChevronRight size={14} />
                </button>
              </div>
            )}

            {showOffer && !offerDone && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">Your Offer</h4>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={offerQty}
                    onChange={(e) => setOfferQty(Number(e.target.value))}
                    max={listing.available_quantity_kg}
                  />
                </div>
                <div>
                  <label className="form-label">Price per kg (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">Note (optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={offerNote}
                    onChange={(e) => setOfferNote(e.target.value)}
                    placeholder="Incoterm, delivery date, etc."
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
                  <span className="text-text-muted">Total estimated</span>
                  <span className="font-bold font-mono text-brand-400">
                    {fmtMoney(offerQty * offerPrice)}
                  </span>
                </div>

                {offerError && (
                  <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                    {offerError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    className="btn flex-1 justify-center"
                    onClick={() => setShowOffer(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary flex-1 justify-center"
                    disabled={offerLoading || !offerQty || !offerPrice}
                    onClick={handleOffer}
                  >
                    {offerLoading ? 'Submitting…' : 'Submit Offer'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <Leaf size={14} className="text-brand-400" />
                {listing.organic_claim_status === 'attested' ? 'Organic certified' : 'Conventional'}
              </div>
              <div className="flex items-center gap-2">
                <Ship size={14} />
                Incoterm: {listing.incoterm}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
