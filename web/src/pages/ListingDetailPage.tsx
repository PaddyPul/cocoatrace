import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Circle, Download, FileCheck2, Leaf, MapPin, PackageCheck, Ship, Sparkles, Sprout, TriangleAlert } from 'lucide-react';
import { listings, offers, provenance as provenanceApi } from '../api';
import { Listing, ProvenancePack } from '../types';
import Layout from '../components/layout/Layout';
import { SkeletonDetail } from '../components/shared/Skeleton';
import { fmtMoney } from '../components/shared/helpers';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/shared/ToastProvider';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDo } = usePermission();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [pack, setPack] = useState<ProvenancePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [offerError, setOfferError] = useState('');

  useEffect(() => {
    if (!id) return;
    listings.get(id).then((row) => {
      setListing(row); setQuantity(row.available_quantity_kg || 0); setPrice(row.price_per_kg || 0);
      if (row.batch_id) provenanceApi.get(row.batch_id).then(setPack).catch(() => undefined);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [id]);

  const match = useMemo(() => listing ? Math.min(98, 58 + (listing.organic_claim_status === 'attested' ? 18 : 0) + (listing.farm_region ? 10 : 0) + (listing.incoterm === 'CIF' ? 7 : 0)) : 0, [listing]);
  const submit = async () => {
    if (!listing || quantity <= 0 || price <= 0 || quantity > listing.available_quantity_kg) { setOfferError('Enter a valid quantity and price within the available supply.'); return; }
    setBusy(true); setOfferError('');
    try { await offers.create(listing.id, { quantityKg: Number(quantity), offeredPricePerKg: Number(price), currency: 'EUR' }); setSent(true); toast('success', 'Offer sent with the verified lot attached.'); }
    catch (err: any) { setOfferError(err.message); } finally { setBusy(false); }
  };

  if (loading) return <Layout currentPage="listing"><SkeletonDetail /></Layout>;
  if (error || !listing) return <Layout currentPage="listing"><div className="rounded-2xl border border-red-500/30 bg-red-900/10 p-4 text-xs text-red-300">{error || 'Listing not found'}</div></Layout>;

  const batch: any = pack?.batch;
  const checks = pack?.policyCheckResults || [];
  const completeness = pack?.completenessPercent || 0;
  const passed = checks.filter((item) => item.passed).length;
  return <Layout currentPage="listing" actions={<button className="btn" onClick={() => navigate('/marketplace')}><ArrowLeft size={14} />Back to matches</button>}>
    <section className="relative overflow-hidden rounded-3xl border border-brand-400/20 bg-[radial-gradient(circle_at_85%_0%,rgba(239,190,106,.2),transparent_28%),linear-gradient(135deg,#173326,#101c16)] p-6 sm:p-8">
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex flex-wrap gap-2"><span className="badge badge-green"><BadgeCheck size={11} />{match}% requirement match</span><span className="badge badge-blue">{listing.grade || 'Export grade'}</span></div><h2 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{listing.farm_name || `${listing.crop || 'Cocoa'} verified lot`}</h2><p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-50/60"><MapPin size={15} />{listing.farm_region || listing.origin_location || 'Origin recorded'}<span>·</span>{listing.seller_name || 'Verified supplier'}</p></div><div className="grid grid-cols-3 gap-3"><HeroMetric label="Available" value={`${Number(listing.available_quantity_kg).toLocaleString()} kg`} /><HeroMetric label="Indicative" value={`€${Number(listing.price_per_kg).toFixed(2)}/kg`} /><HeroMetric label="Delivery" value={`${listing.incoterm} ${listing.destination_location || 'Rotterdam'}`} /></div></div>
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]"><div className="space-y-5">
      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Buyer-visible proof</div><h3 className="mt-1 text-xl font-bold">Why this lot matches</h3></div><div className="flex gap-2"><span className={`badge ${completeness >= 90 ? 'badge-green' : 'badge-amber'}`}>{completeness || '—'}% dossier</span><span className="badge badge-green">Identity preserved</span></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Proof icon={Sprout} title="Field-level origin" value={batch?.farm_name || listing.farm_name || 'Linked farm record'} detail={`${batch?.region || listing.farm_region || 'Origin'} · ${batch?.country || 'Ghana'}`} ok={Boolean(batch?.farm_name || listing.farm_name)} /><Proof icon={Leaf} title="Organic assurance" value={batch?.standard || (listing.organic_claim_status === 'attested' ? 'EU Organic evidence' : 'Review required')} detail={batch?.certifier_name || 'Certificate scope remains inspectable'} ok={listing.organic_claim_status === 'attested'} /><Proof icon={PackageCheck} title="Physical lot" value={batch?.id ? `Batch ${String(batch.id).slice(0, 8)}` : 'Recorded holding'} detail="Quantity and custody stay linked to the trade" ok /><Proof icon={FileCheck2} title="Policy checks" value={checks.length ? `${passed} of ${checks.length} passed` : 'Evidence pack available'} detail={pack?.eudrReadiness?.ready ? 'EUDR data ready' : 'Open gaps remain visible'} ok={Boolean(pack?.eudrReadiness?.ready)} /></div></section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Field to fulfilment</div><h3 className="mt-1 text-xl font-bold">One identity through every handoff</h3></div>{batch?.id && canDo('provenance.export') && <button className="btn btn-sm" onClick={() => provenanceApi.exportBatch(batch.id)}><Download size={13} />Export pack</button>}</div><div className="mt-5 grid gap-3 md:grid-cols-4"><TraceStep done icon={Sprout} title="Farm & plots" copy={batch?.farm_name || listing.farm_name || 'Origin linked'} /><TraceStep done icon={PackageCheck} title="Harvest lot" copy={batch?.grade || listing.grade || 'Identity assigned'} /><TraceStep active icon={BadgeCheck} title="Verified supply" copy="Published to matched buyers" /><TraceStep icon={Ship} title="Shipment" copy="Created after trade award" /></div>{batch?.att_hash && <div className="mt-4 rounded-2xl bg-surface-darker p-4"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">Attributable provenance hash</div><div className="mt-2 break-all font-mono text-[10px] text-text-secondary">{batch.att_hash}</div></div>}</section>

      <section className="flex items-start gap-4 rounded-3xl border border-brand-400/20 bg-brand-400/5 p-5"><Sparkles size={20} className="mt-0.5 shrink-0 text-brand-400" /><div><div className="text-sm font-bold">Grounded match explanation</div><p className="mt-1 text-xs leading-5 text-text-muted">This lot matches Ghana origin, organic assurance and commercial delivery terms. {pack?.eudrReadiness?.ready ? 'The recorded EUDR inputs are ready for buyer review.' : 'The buyer should resolve the highlighted EUDR evidence gap before release.'} This explanation summarizes records; it does not certify the lot.</p></div></section>
    </div>

    <aside className="space-y-5"><section className="sticky top-6 rounded-3xl border border-border bg-surface p-5 sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">Commercial decision</div><h3 className="mt-1 text-xl font-bold">Build an offer</h3>{sent ? <div className="mt-6 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-5 text-center"><CheckCircle2 size={28} className="mx-auto text-brand-400" /><div className="mt-3 text-sm font-bold">Offer sent with proof attached</div><p className="mt-2 text-xs leading-5 text-text-muted">The supplier sees your commercial terms while both sides keep this same verified lot identity.</p><button className="btn btn-primary mt-5 w-full justify-center" onClick={() => navigate('/offers')}>Track my offer <ArrowRight size={14} /></button></div> : <><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Quantity (kg)"><input type="number" className="form-input" value={quantity} max={listing.available_quantity_kg} onChange={(event) => setQuantity(Number(event.target.value))} /></Field><Field label="Price per kg (€)"><input type="number" step="0.01" className="form-input" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-darker p-4"><span className="text-xs text-text-muted">Estimated trade value</span><span className="font-mono text-lg font-bold text-brand-300">{fmtMoney(quantity * price)}</span></div>{offerError && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300">{offerError}</div>}{canDo('offer.create') ? <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950" onClick={submit} disabled={busy}>{busy ? 'Sending offer…' : <>Send evidence-backed offer <ArrowRight size={15} /></>}</button> : <div className="mt-4 rounded-xl border border-border p-3 text-xs text-text-muted">Your current role can review this lot but cannot create a commercial offer.</div>}</>}
        <div className="mt-5 space-y-2 border-t border-border pt-5"><Assurance ok label="Seller identity recorded" /><Assurance ok={listing.organic_claim_status === 'attested'} label="Organic claim supported" /><Assurance ok={Boolean(pack?.eudrReadiness?.ready)} label="EUDR inputs ready" /></div><p className="mt-4 text-[10px] leading-4 text-text-muted">CocoaTrace records the offer and evidence context. Payment and regulated escrow remain with approved providers.</p></section></aside></div>
  </Layout>;
}

function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-28 rounded-2xl border border-white/10 bg-black/15 p-4"><div className="text-[9px] uppercase tracking-wider text-white/45">{label}</div><div className="mt-2 text-xs font-bold text-white">{value}</div></div>; }
function Proof({ icon: Icon, title, value, detail, ok }: { icon: typeof Leaf; title: string; value: string; detail: string; ok: boolean }) { return <div className="flex gap-3 rounded-2xl border border-border bg-surface-darker p-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ok ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}><Icon size={17} /></span><div><div className="text-[9px] uppercase tracking-wider text-text-muted">{title}</div><div className="mt-1 text-xs font-bold">{value}</div><div className="mt-1 text-[10px] leading-4 text-text-muted">{detail}</div></div></div>; }
function TraceStep({ icon: Icon, title, copy, done = false, active = false }: { icon: typeof Sprout; title: string; copy: string; done?: boolean; active?: boolean }) { return <div className={`rounded-2xl border p-4 ${active ? 'border-brand-400/40 bg-brand-400/5' : 'border-border bg-surface-darker'}`}><span className={`grid h-8 w-8 place-items-center rounded-full ${done ? 'bg-brand-400 text-emerald-950' : active ? 'border border-brand-400 text-brand-400' : 'bg-white/5 text-text-muted'}`}>{done ? <Check size={14} /> : <Icon size={14} />}</span><div className="mt-3 text-xs font-bold">{title}</div><div className="mt-1 text-[10px] leading-4 text-text-muted">{copy}</div></div>; }
function Assurance({ ok, label }: { ok: boolean; label: string }) { return <div className="flex items-center gap-2 text-xs text-text-secondary">{ok ? <CheckCircle2 size={14} className="text-brand-400" /> : <TriangleAlert size={14} className="text-amber-300" />}{label}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="form-label">{label}</span>{children}</label>; }
