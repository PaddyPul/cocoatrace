import { useUnsavedChanges } from '../components/shared/UnsavedChanges';
import ExternalNegotiationNotice from '../components/trading/ExternalNegotiationNotice';
import QuantityCoverage from '../components/trading/QuantityCoverage';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/errors';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Circle,
  Download,
  FileCheck2,
  Leaf,
  MapPin,
  PackageCheck,
  Ship,
  Sparkles,
  Sprout,
  TriangleAlert,
} from 'lucide-react';
import { listings, offers, sourcing, provenance as provenanceApi } from '../api';
import type { Listing, SourcingRequest } from '../domains/marketplace/types';
import type { ProvenancePack } from '../domains/provenance/types';
import TrustClaims, { isReviewed, trustLabel } from '../components/shared/TrustClaims';
import Layout from '../components/layout/Layout';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { fmtMoney } from '../components/shared/helpers';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/shared/ToastProvider';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const [request, setRequest] = useState<SourcingRequest | null>(null);
  const [requestError, setRequestError] = useState('');
  const [requestLoading, setRequestLoading] = useState(Boolean(requestId));
  const [partialAccepted, setPartialAccepted] = useState(false);
  useEffect(() => {
    let active = true;
    setRequest(null);
    setRequestError('');
    setPartialAccepted(false);
    setRequestLoading(Boolean(requestId));
    if (requestId)
      sourcing
        .page({ mine: 'true', id: requestId, limit: '1' })
        .then((result) => {
          if (!active) return;
          const row = result.items?.find((item) => item.id === requestId);
          if (!row || !Number.isFinite(Number(row.quantity_kg)) || Number(row.quantity_kg) <= 0)
            throw new Error();
          setRequest(row);
        })
        .catch(() => {
          if (active)
            setRequestError(
              'Sourcing quantity context could not be loaded. Return to matched supply and retry before offering.',
            );
        })
        .finally(() => {
          if (active) setRequestLoading(false);
        });
    return () => {
      active = false;
    };
  }, [requestId]);
  const { canDo } = usePermission();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [pack, setPack] = useState<ProvenancePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packError, setPackError] = useState('');
  const retryRead = useRef<() => void>(() => {});
  const [quantity, setQuantity] = useState(0);
  const partialOrder = Boolean(request && quantity > 0 && quantity < Number(request.quantity_kg));
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);
  const [offerError, setOfferError] = useState('');
  const [initialOffer, setInitialOffer] = useState({ quantity: 0, price: 0 });
  const clearOfferDraft = useUnsavedChanges(
    !sent && (quantity !== initialOffer.quantity || price !== initialOffer.price),
    'Commercial offer',
  );

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setListing(null);
    setPack(null);
    setError('');
    setPackError('');
    let initialized = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const row = await listings.get(id);
        if (!alive) return;
        if (!row || row.id !== id) throw new Error('Invalid supply response.');
        setListing(row);
        setError('');
        if (!initialized) {
          setInitialOffer({
            quantity: row.available_quantity_kg || 0,
            price: row.price_per_kg || 0,
          });
          setQuantity(row.available_quantity_kg || 0);
          setPrice(row.price_per_kg || 0);
          initialized = true;
        }
        if (row.batch_id) {
          try {
            const currentPack = await provenanceApi.get(row.batch_id);
            if (alive) {
              setPack(currentPack);
              setPackError('');
            }
          } catch (error) {
            if (alive) {
              setPack(null);
              setPackError(
                error instanceof ApiError && error.status === 403
                  ? 'Source records are private. This account cannot open the full source dossier. Review the published claim summaries below and ask the supplier to share any additional evidence needed before committing.'
                  : error instanceof Error
                    ? error.message
                    : 'Provenance unavailable',
              );
            }
          }
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Unable to refresh supply');
          if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
            setListing(null);
            setPack(null);
          }
        }
      } finally {
        refreshing = false;
        if (alive) setLoading(false);
      }
    };
    retryRead.current = () => {
      void refresh();
    };
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(visible, 15_000);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [id]);

  useEffect(() => {
    if (redirectSeconds === null) return;
    if (redirectSeconds <= 0) {
      navigate('/home?mode=buy');
      return;
    }
    const timer = window.setTimeout(
      () => setRedirectSeconds((value) => (value === null ? null : value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [redirectSeconds, navigate]);

  const expired = Boolean(
    listing?.expires_at && new Date(listing.expires_at).getTime() <= Date.now(),
  );
  const unavailable = expired || listing?.active === false;
  const submit = async () => {
    if (error) {
      setOfferError('Refresh the supply before submitting an offer. Your draft is retained.');
      return;
    }
    if (unavailable) {
      setOfferError(
        'This publication is unavailable. The supplier must review current stock before a new offer.',
      );
      return;
    }
    if (listing?.activeRecall) {
      setOfferError('This supply is on recall hold. New offers are blocked.');
      return;
    }
    if (requestLoading || requestError || (partialOrder && !partialAccepted)) {
      setOfferError(
        'Review the sourcing quantity and acknowledge the partial order before sending.',
      );
      return;
    }
    if (!listing || quantity <= 0 || price <= 0 || quantity > listing.available_quantity_kg) {
      setOfferError('Enter a valid quantity and price within the available supply.');
      return;
    }
    setBusy(true);
    setOfferError('');
    try {
      await offers.create(listing.id, {
        quantityKg: Number(quantity),
        offeredPricePerKg: Number(price),
        currency: listing.currency,
      });
      clearOfferDraft();
      setSent(true);
      setRedirectSeconds(3);
      toast('success', 'Offer sent. Your dashboard will track what happens next.');
    } catch (err: any) {
      setOfferError(err.message);
      // A recall can become active while the buyer is preparing an offer.
      try {
        const current = await listings.get(listing.id);
        if (!current || current.id !== listing.id) {
          setError('Invalid supply response.');
          setListing(null);
          return;
        }
        setListing(current);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Unable to refresh supply after offer failure.',
        );
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          setListing(null);
          setPack(null);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Layout currentPage="listing">
        <SkeletonDetail />
      </Layout>
    );
  if (!listing)
    return (
      <Layout currentPage="listing">
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-300"
        >
          {error || 'Listing not found'}
        </div>
        <button className="btn mt-3" onClick={() => retryRead.current()}>
          Retry supply
        </button>
        <button className="btn mt-3 ml-2" onClick={() => navigate('/marketplace')}>
          Back to supply
        </button>
      </Layout>
    );

  const batch: any = pack?.batch;
  const directInventory =
    listing.source_mode === 'direct_inventory' || batch?.source_mode === 'direct_inventory';
  const farmName = directInventory ? null : batch?.farm_name || listing.farm_name;
  const sourceName = directInventory
    ? listing.source_name || 'Supplier-declared source'
    : farmName || 'Farm not recorded';
  const sourceLocation = directInventory
    ? [listing.source_region, listing.source_country].filter(Boolean).join(' · ') ||
      'Source location not recorded'
    : [batch?.region || listing.farm_region, batch?.country || listing.source_country]
        .filter(Boolean)
        .join(' · ') || 'Source location not recorded';
  const checks = pack?.policyCheckResults || [];
  const completeness = pack?.completenessPercent || 0;
  const passed = checks.filter((item) => item.passed).length;
  return (
    <Layout
      currentPage="listing"
      actions={
        <button className="btn" onClick={() => navigate('/marketplace')}>
          <ArrowLeft size={14} />
          Back to matches
        </button>
      }
    >
      <section className="relative overflow-hidden rounded-3xl border border-brand-400/20 bg-[radial-gradient(circle_at_85%_0%,rgba(239,190,106,.2),transparent_28%),linear-gradient(135deg,#173326,#101c16)] p-6 sm:p-8">
        {error && (
          <div role="alert" className="mb-4 rounded border border-amber-400/30 p-3 text-sm">
            Supply refresh unavailable. {error} Your offer draft is retained; refresh before
            submitting.
            <button className="btn ml-2" onClick={() => retryRead.current()}>
              Retry supply
            </button>
          </div>
        )}
        {packError && (
          <div role="alert" className="mb-4 rounded border border-amber-400/30 p-3 text-sm">
            Source records unavailable. {packError}
            <button className="btn ml-2" onClick={() => retryRead.current()}>
              Retry source records
            </button>
          </div>
        )}
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`badge ${listing.activeRecall ? 'badge-red' : 'badge-green'}`}>
                <BadgeCheck size={11} />
                {listing.activeRecall
                  ? 'Recall hold'
                  : expired
                    ? 'Expired supply'
                    : listing.active === false
                      ? 'Unavailable supply'
                      : 'Published supply'}
              </span>
              <span className="badge badge-blue">{listing.grade || 'Grade not recorded'}</span>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">
              {farmName || `${listing.crop || 'Material'} ${directInventory ? 'inventory' : 'lot'}`}
            </h2>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-50/60">
              <MapPin size={15} />
              {listing.farm_region || listing.origin_location || 'Origin not recorded'}
              <span>·</span>
              {listing.seller_name || 'Supplier name not recorded'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HeroMetric
              label="Available"
              value={`${Number(listing.available_quantity_kg).toLocaleString()} kg`}
            />
            <HeroMetric
              label="Indicative"
              value={`${listing.currency} ${Number(listing.price_per_kg).toFixed(4)}/kg`}
            />
            <HeroMetric
              label="Delivery"
              value={`${listing.incoterm} ${listing.destination_location || 'Destination not recorded'}`}
            />
          </div>
        </div>
      </section>

      {expired && (
        <div role="status" className="mt-5 rounded-2xl border border-amber-500/30 p-4">
          This listing has expired. New offers are blocked until the supplier reviews and renews the
          publication.
        </div>
      )}
      {listing.activeRecall && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-sm text-red-300"
        >
          <TriangleAlert size={18} className="shrink-0" />
          <div>
            <strong>Supply on recall hold</strong>
            <p className="mt-1 text-xs">
              An active recall affects this material. New offers and material movement are blocked.
              Review the recall notice and instructions before proceeding.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">
                  Buyer-visible proof
                </div>
                <h3 className="mt-1 text-xl font-bold">Recorded lot evidence</h3>
              </div>
              <div className="flex gap-2">
                <span className={`badge ${completeness >= 90 ? 'badge-green' : 'badge-amber'}`}>
                  {packError ? 'Dossier unavailable' : `${completeness || '—'}% dossier`}
                </span>
                <span className="badge badge-blue">Recorded inventory</span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Proof
                icon={Sprout}
                title={directInventory ? 'Declared inventory source' : 'Field-level origin'}
                value={sourceName}
                detail={sourceLocation}
                ok={directInventory ? Boolean(listing.source_name) : Boolean(farmName)}
              />
              <Proof
                icon={Leaf}
                title="Organic assurance"
                value={trustLabel(listing.trust?.organic)}
                detail={listing.trust?.organic.reviewerName || 'Review details below'}
                ok={isReviewed(listing.trust?.organic)}
              />
              <Proof
                icon={PackageCheck}
                title="Physical lot"
                value={batch?.id ? `Batch ${String(batch.id).slice(0, 8)}` : 'Recorded holding'}
                detail="Quantity and custody stay linked to the trade"
                ok
              />
              <Proof
                icon={FileCheck2}
                title="Policy checks"
                value={
                  packError
                    ? 'Checks unavailable'
                    : checks.length
                      ? `${passed} of ${checks.length} recorded checks passed`
                      : 'Checks not recorded'
                }
                detail={trustLabel(listing.trust?.eudr)}
                ok={isReviewed(listing.trust?.eudr)}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">
                  {directInventory ? 'Inventory to fulfilment' : 'Field to fulfilment'}
                </div>
                <h3 className="mt-1 text-xl font-bold">One identity through every handoff</h3>
              </div>
              {batch?.id && canDo('provenance.export') && (
                <button className="btn btn-sm" onClick={() => provenanceApi.exportBatch(batch.id)}>
                  <Download size={13} />
                  Export pack
                </button>
              )}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <TraceStep
                done={directInventory ? Boolean(listing.source_name) : Boolean(farmName)}
                icon={directInventory ? PackageCheck : Sprout}
                title={directInventory ? 'Declared source' : 'Farm & plots'}
                copy={sourceName}
              />
              <TraceStep
                done
                icon={PackageCheck}
                title={directInventory ? 'Inventory lot' : 'Harvest lot'}
                copy={batch?.grade || listing.grade || 'Identity assigned'}
              />
              <TraceStep
                active
                icon={BadgeCheck}
                title="Published supply"
                copy="Available for buyer review"
              />
              <TraceStep icon={Ship} title="Shipment" copy="Created after trade award" />
            </div>
            {batch?.att_hash && (
              <div className="mt-4 rounded-2xl bg-surface-darker p-4">
                <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">
                  Attributable provenance hash
                </div>
                <div className="mt-2 break-all font-mono text-[10px] text-text-secondary">
                  {batch.att_hash}
                </div>
              </div>
            )}
          </section>

          <section className="flex items-start gap-4 rounded-3xl border border-brand-400/20 bg-brand-400/5 p-5">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-brand-400" />
            <div>
              <div className="text-sm font-bold">Evidence review</div>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                Compare this lot’s quantity, commercial terms and claim review details with your
                sourcing needs. Recorded inputs do not certify origin, organic status or regulatory
                compliance.
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <ExternalNegotiationNotice />
          <TrustClaims trust={listing.trust} />
          <section className="sticky top-6 rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">
              Commercial decision
            </div>
            <h3 className="mt-1 text-xl font-bold">Build an offer</h3>
            {requestLoading && <p role="status">Loading requested quantity…</p>}
            {requestError && <p role="alert">{requestError}</p>}
            {request && (
              <QuantityCoverage
                requested={Number(request.quantity_kg)}
                available={Number(quantity)}
                offer
              />
            )}
            {partialOrder && (
              <label className="mt-3 flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={partialAccepted}
                  onChange={(e) => setPartialAccepted(e.target.checked)}
                />
                I understand this is a partial order and the remaining quantity must be sourced
                separately.
              </label>
            )}
            {sent ? (
              <div className="mt-6 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-5 text-center">
                <CheckCircle2 size={28} className="mx-auto text-brand-400" />
                <div className="mt-3 text-sm font-bold">Offer submitted</div>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  The supplier can now review it. Home will show whether you are waiting or need to
                  take the next action.
                </p>
                <div className="mt-3 text-[10px] font-semibold text-brand-300">
                  Redirecting to your dashboard in {redirectSeconds ?? 0}…
                </div>
                <button
                  className="btn btn-primary mt-5 w-full justify-center"
                  onClick={() => navigate('/home?mode=buy')}
                >
                  Go to dashboard now <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Quantity (kg)">
                    <input
                      type="number"
                      className="form-input"
                      value={quantity}
                      max={listing.available_quantity_kg}
                      onChange={(event) => {
                        setQuantity(Number(event.target.value));
                        setPartialAccepted(false);
                      }}
                    />
                  </Field>
                  <Field label={`Price per kg (${listing.currency})`}>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-input"
                      value={price}
                      onChange={(event) => setPrice(Number(event.target.value))}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-darker p-4">
                  <span className="text-xs text-text-muted">Estimated trade value</span>
                  <span className="font-mono text-lg font-bold text-brand-300">
                    {fmtMoney(quantity * price, listing.currency)}
                  </span>
                </div>
                {offerError && (
                  <div className="mt-3 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300">
                    {offerError}
                  </div>
                )}
                {canDo('offer.create') ? (
                  <button
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950"
                    onClick={submit}
                    disabled={
                      busy ||
                      Boolean(error) ||
                      listing.activeRecall ||
                      unavailable ||
                      requestLoading ||
                      Boolean(requestError) ||
                      (partialOrder && !partialAccepted)
                    }
                  >
                    {listing.activeRecall ? (
                      'Offers blocked — recall hold'
                    ) : unavailable ? (
                      'Offers blocked — publication unavailable'
                    ) : busy ? (
                      'Sending offer…'
                    ) : (
                      <>
                        Send evidence-backed offer <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="mt-4 rounded-xl border border-border p-3 text-xs text-text-muted">
                    Your current role can review this lot but cannot create a commercial offer.
                  </div>
                )}
              </>
            )}
            <div className="mt-5 space-y-2 border-t border-border pt-5">
              <Assurance ok={Boolean(listing.seller_name)} label="Supplier workspace recorded" />
              <Assurance
                ok={isReviewed(listing.trust?.organic)}
                label={`Organic: ${trustLabel(listing.trust?.organic)}`}
              />
              <Assurance
                ok={isReviewed(listing.trust?.eudr)}
                label={`EUDR inputs: ${trustLabel(listing.trust?.eudr)}`}
              />
            </div>
            <p className="mt-4 text-[10px] leading-4 text-text-muted">
              BetterTrade records the offer and evidence context. Payment and regulated escrow
              remain with approved providers.
            </p>
          </section>
        </aside>
      </div>
    </Layout>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="text-[9px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-2 text-xs font-bold text-white">{value}</div>
    </div>
  );
}
function Proof({
  icon: Icon,
  title,
  value,
  detail,
  ok,
}: {
  icon: typeof Leaf;
  title: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface-darker p-4">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ok ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}
      >
        <Icon size={17} />
      </span>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-text-muted">{title}</div>
        <div className="mt-1 text-xs font-bold">{value}</div>
        <div className="mt-1 text-[10px] leading-4 text-text-muted">{detail}</div>
      </div>
    </div>
  );
}
function TraceStep({
  icon: Icon,
  title,
  copy,
  done = false,
  active = false,
}: {
  icon: typeof Sprout;
  title: string;
  copy: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${active ? 'border-brand-400/40 bg-brand-400/5' : 'border-border bg-surface-darker'}`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-full ${done ? 'bg-brand-400 text-emerald-950' : active ? 'border border-brand-400 text-brand-400' : 'bg-white/5 text-text-muted'}`}
      >
        {done ? <Check size={14} /> : <Icon size={14} />}
      </span>
      <div className="mt-3 text-xs font-bold">{title}</div>
      <div className="mt-1 text-[10px] leading-4 text-text-muted">{copy}</div>
    </div>
  );
}
function Assurance({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      {ok ? (
        <CheckCircle2 size={14} className="text-brand-400" />
      ) : (
        <TriangleAlert size={14} className="text-amber-300" />
      )}
      {label}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}
