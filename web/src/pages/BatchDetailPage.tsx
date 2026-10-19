import { ApiError } from '../api/errors';
import { useUnsavedChanges, useDiscardChanges } from '../components/shared/UnsavedChanges';
import BatchEvidence from '../components/catalog/BatchEvidence';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import CertificatePicker from '../components/catalog/CertificatePicker';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { batches as batchesApi, productProfiles as productProfilesApi } from '../api';
import type { Batch } from '../domains/source/types';
import type { ProductProfile } from '../domains/product/types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Shield, ChevronRight, QrCode, ExternalLink } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readVersion, setReadVersion] = useState(0);
  const [profileVersion, setProfileVersion] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [publicationReview, setPublicationReview] = useState<ProductProfile | null>(null);
  const [publicationError, setPublicationError] = useState('');

  const [showPush, setShowPush] = useState(false);
  const [pqty, setPqty] = useState(0);
  const [pprice, setPprice] = useState(0);
  const [pcurrency, setPcurrency] = useState('EUR');
  const [porigin, setPorigin] = useState('');
  const [pdest, setPdest] = useState('');
  const [pincoterm, setPincoterm] = useState('CIF');
  const [pushing, setPushing] = useState(false);
  const [pushDone, setPushDone] = useState(false);
  const [createdListingId, setCreatedListingId] = useState('');
  const [pushErr, setPushErr] = useState('');

  const [showAttest, setShowAttest] = useState(false);
  const [attCertId, setAttCertId] = useState('');
  const [attNotes, setAttNotes] = useState('');
  const [attesting, setAttesting] = useState(false);
  const [attErr, setAttErr] = useState('');
  const [pushBaseline, setPushBaseline] = useState({ quantity: 0, origin: '', destination: '' });
  const pushDirty =
    pqty !== pushBaseline.quantity ||
    pprice !== 0 ||
    pcurrency !== 'EUR' ||
    porigin !== pushBaseline.origin ||
    pdest !== pushBaseline.destination ||
    pincoterm !== 'CIF';
  const attDirty = Boolean(attCertId || attNotes);
  const clearPushDraft = useUnsavedChanges(
    showPush && !pushDone && pushDirty,
    'Batch supply publication',
  );
  const clearAttDraft = useUnsavedChanges(showAttest && attDirty, 'Batch attestation');
  const discardPush = useDiscardChanges(pushDirty);
  const discardAtt = useDiscardChanges(attDirty);
  const closePush = () =>
    discardPush(() => {
      setShowPush(false);
      setPqty(pushBaseline.quantity);
      setPprice(0);
      setPcurrency('EUR');
      setPorigin(pushBaseline.origin);
      setPdest(pushBaseline.destination);
      setPincoterm('CIF');
      setPushErr('');
    });
  const closeAtt = () =>
    discardAtt(() => {
      setShowAttest(false);
      setAttCertId('');
      setAttNotes('');
      setAttErr('');
    });

  const canAttest = batch
    ? batch.organic_claim_status === 'pending_attestation' && canDo('batch.attest')
    : false;

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');
    setBatch(null);
    setProductProfile(null);
    batchesApi
      .get(id)
      .then((d) => {
        if (!active) return;
        if (!d?.batch || d.batch.id !== id) throw new Error('Invalid batch response.');
        setBatch(d.batch);
        setPushBaseline({
          quantity: d.batch.quantity_kg || 0,
          origin: d.batch.region ? `${d.batch.region}, Ghana` : 'Tema, Ghana',
          destination: 'Rotterdam, Netherlands',
        });
        setPqty(d.batch.quantity_kg || 0);
        setPorigin(d.batch.region ? `${d.batch.region}, Ghana` : 'Tema, Ghana');
        setPdest('Rotterdam, Netherlands');
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Batch could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, readVersion]);

  useEffect(() => {
    setAttCertId('');
    setShowAttest(false);
  }, [id]);

  const profileBatchId = batch?.id;
  useEffect(() => {
    if (!profileBatchId) return;
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    setProductProfile(null);
    productProfilesApi
      .getForBatch(profileBatchId)
      .then((profile) => {
        if (!active) return;
        if (
          !profile ||
          profile.batch_id !== profileBatchId ||
          typeof profile.id !== 'string' ||
          !['draft', 'published', 'archived'].includes(profile.visibility)
        )
          throw new Error('Invalid product profile response.');
        setProductProfile(profile);
      })
      .catch((error) => {
        if (active && !(error instanceof ApiError && error.status === 404))
          setProfileError(
            error instanceof Error ? error.message : 'Product profile could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileBatchId, profileVersion]);
  const handleAttest = async () => {
    if (!batch || !attCertId) {
      setAttErr('Select a certificate');
      return;
    }
    setAttesting(true);
    setAttErr('');
    try {
      await batchesApi.attest(batch.id, { certificateId: attCertId, notes: attNotes || undefined });
      clearAttDraft();
      setAttNotes('');
      setShowAttest(false);
      toast('success', 'Batch attested successfully');
      const d = await batchesApi.get(batch.id);
      setBatch(d.batch);
    } catch (e: any) {
      setAttErr(e.message);
    } finally {
      setAttesting(false);
    }
  };

  const canPush = batch
    ? batch.current_holder_id === user?.organizationId && canDo('batch.create')
    : false;

  const handleCreateProfile = async () => {
    if (!batch) return;
    setProfileBusy(true);
    setProfileError('');
    try {
      const farmPart = (batch.farm_name || 'origin')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const profile = await productProfilesApi.save({
        batchId: batch.id,
        slug: `${farmPart}-${batch.crop || 'product'}-${batch.id.slice(0, 8)}`,
        displayName: `${batch.farm_name || 'Origin'} ${batch.crop || 'product'} · ${new Date(batch.harvest_date).getFullYear()} harvest`,
        brandName: batch.holder_name,
        description: `Trace this ${batch.crop || 'product'} from farm origin through verification, custody and delivery.`,
        lotCode: `CT-${batch.id.slice(0, 8).toUpperCase()}`,
      });
      setProductProfile(profile);
      toast('success', 'Draft product page created');
    } catch (e: any) {
      setProfileError(e.message);
      toast('error', e.message);
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePublishProfile = async () => {
    if (!publicationReview || profileBusy) return;
    setProfileBusy(true);
    setPublicationError('');
    try {
      await productProfilesApi.publish(publicationReview.id);
      setPublicationReview(null);
      setProfileVersion((value) => value + 1);
      toast('success', 'Product page published — refreshing its current public identity.');
    } catch (e: any) {
      setPublicationError(e.message);
      toast('error', e.message);
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePush = async () => {
    if (!batch || !pqty || pqty <= 0 || !pprice || pprice <= 0) {
      setPushErr('Quantity and price required');
      return;
    }
    setPushing(true);
    setPushErr('');
    try {
      const listing = await batchesApi.pushToMarketplace(batch.id, {
        quantityKg: Number(pqty),
        pricePerKg: Number(pprice),
        currency: pcurrency,
        incoterm: pincoterm,
        originLocation: porigin,
        destinationLocation: pdest,
      });
      setCreatedListingId(listing.id);
      clearPushDraft();
      setPushDone(true);
      toast('success', 'Batch listed on marketplace');
    } catch (e: any) {
      setPushErr(e.message);
    } finally {
      setPushing(false);
    }
  };

  if (loading)
    return (
      <Layout currentPage="batch">
        <SkeletonDetail />
      </Layout>
    );
  if (error || !batch)
    return (
      <Layout currentPage="batch">
        <div
          role="alert"
          className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400"
        >
          {error || 'Batch not found'}
        </div>
        <button className="btn mt-3" onClick={() => setReadVersion((value) => value + 1)}>
          Retry batch
        </button>
        <button className="btn mt-3 ml-2" onClick={() => navigate('/batches')}>
          Back to batches
        </button>
      </Layout>
    );

  return (
    <Layout
      currentPage="batch"
      actions={
        <button className="btn btn-sm" onClick={() => navigate('/batches')}>
          <ArrowLeft size={14} /> Back
        </button>
      }
    >
      {canDo('evidence.upload') && (
        <button
          className="btn mb-4"
          onClick={() => navigate(`/evidence/contribute?entityType=batch&entityId=${id}`)}
        >
          Add supporting evidence
        </button>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="h-40 bg-surface-darker flex items-center justify-center text-5xl relative">
              📦
              <div className="absolute top-3 right-3 flex gap-2">
                <StatusBadge status={batch.organic_claim_status} />
                {batch.grade && <span className="badge badge-blue">{batch.grade}</span>}
              </div>
            </div>
            <div className="p-5">
              <h1 className="text-xl font-bold text-text-primary mb-1">
                Batch {batch.id.slice(0, 8)}…
              </h1>
              <p className="text-sm text-text-muted">
                {batch.farm_name || 'Unknown farm'} · {batch.crop}
                {batch.region ? ` · ${batch.region}` : ''}
              </p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Harvest Date
                  </div>
                  <div className="font-medium">{fmtDate(batch.harvest_date)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Quantity
                  </div>
                  <div className="font-medium font-mono">
                    {(batch.quantity_kg || 0).toLocaleString()} kg
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Holder
                  </div>
                  <div className="font-medium">
                    {batch.holder_name || batch.current_holder_id?.slice(0, 8)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Crop
                  </div>
                  <div className="font-medium">{batch.crop || 'cocoa'}</div>
                </div>
              </div>
            </div>
          </div>

          {batch.att_hash && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield size={16} className="text-brand-400" /> Attestation
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Provenance Hash
                  </div>
                  <div className="font-mono text-[10px] text-text-muted break-all">
                    {batch.att_hash}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Attested At
                  </div>
                  <div>{batch.attested_at ? fmtDate(batch.attested_at) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Certificate
                  </div>
                  <div>
                    {batch.standard || '—'} {batch.cert_standard ? `(${batch.cert_standard})` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    Valid Until
                  </div>
                  <div>{batch.cert_valid_to ? fmtDate(batch.cert_valid_to) : '—'}</div>
                </div>
              </div>
            </div>
          )}

          <BatchEvidence key={id} batchId={id!} />
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <QrCode size={16} className="text-brand-400" /> Public product page
            </div>
            {profileLoading ? (
              <p role="status" className="mt-3 text-xs">
                Loading public product identity…
              </p>
            ) : profileError ? (
              <div className="mt-3 text-xs">
                <p role="alert">Product identity unavailable. {profileError}</p>
                <button
                  className="btn mt-2"
                  onClick={() => setProfileVersion((value) => value + 1)}
                >
                  Retry product identity
                </button>
              </div>
            ) : productProfile ? (
              <div className="mt-4">
                {productProfile.visibility === 'published' ? (
                  <>
                    <div className="rounded bg-white p-3 mx-auto w-fit">
                      <img
                        className="h-36 w-36"
                        src={`/api${productProfile.qrSvgUrl}`}
                        alt={`QR code for ${productProfile.display_name}`}
                      />
                    </div>
                    <div className="mt-3 text-center">
                      <span className="badge badge-green">Live</span>
                      <p className="mt-2 text-xs text-text-muted font-mono">
                        {productProfile.lot_code}
                      </p>
                    </div>
                    <button
                      className="btn w-full justify-center mt-3"
                      onClick={() =>
                        window.open(
                          `/p/${encodeURIComponent(productProfile.slug)}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      <ExternalLink size={13} /> View scanned experience
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-xs text-text-muted">
                      Draft ready for review. Publishing activates the permanent QR destination.
                    </p>
                    <button
                      className="btn btn-primary w-full justify-center mt-3"
                      onClick={() => {
                        setPublicationError('');
                        setPublicationReview(productProfile);
                      }}
                      disabled={profileBusy}
                    >
                      {profileBusy ? 'Publishing…' : 'Publish & activate QR'}
                    </button>
                  </>
                )}
              </div>
            ) : canPush ? (
              <>
                <p className="mt-3 text-xs text-text-muted">
                  Create a stable, public identity for this lot. The QR will always open its latest
                  journey and safety status.
                </p>
                <button
                  className="btn btn-primary w-full justify-center mt-3"
                  onClick={handleCreateProfile}
                  disabled={profileBusy}
                >
                  {profileBusy ? 'Creating…' : 'Create product page'}
                </button>
              </>
            ) : (
              <p className="mt-3 text-xs text-text-muted">
                No public product page has been published for this batch.
              </p>
            )}
          </div>

          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Actions</div>

            {canPush && !showPush && !pushDone && (
              <button
                className="btn btn-primary w-full justify-center mb-2"
                onClick={() => setShowPush(true)}
              >
                List on Marketplace
              </button>
            )}

            {pushDone && (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-sm font-semibold text-brand-400 mb-1">Listed!</div>
                <button
                  className="btn btn-sm mt-2"
                  onClick={() => navigate(`/marketplace?published=${createdListingId}`)}
                >
                  View Marketplace <ChevronRight size={14} />
                </button>
              </div>
            )}

            {showPush && !pushDone && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">Create Listing</h4>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={pqty}
                    onChange={(e) => setPqty(Number(e.target.value))}
                    max={batch.quantity_kg}
                  />
                </div>
                <div>
                  <label className="form-label">Price per kg (€)</label>
                  <select
                    aria-label="Supply currency"
                    className="form-select mb-2"
                    value={pcurrency}
                    onChange={(e) => setPcurrency(e.target.value)}
                  >
                    {['EUR', 'USD', 'GHS', 'GBP', 'JPY'].map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={pprice}
                    onChange={(e) => setPprice(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">Origin</label>
                  <input
                    className="form-input"
                    value={porigin}
                    onChange={(e) => setPorigin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Destination</label>
                  <input
                    className="form-input"
                    value={pdest}
                    onChange={(e) => setPdest(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Incoterm</label>
                  <select
                    className="form-select"
                    value={pincoterm}
                    onChange={(e) => setPincoterm(e.target.value)}
                  >
                    <option>CIF</option>
                    <option>FOB</option>
                    <option>EXW</option>
                    <option>DDP</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
                  <span className="text-text-muted">Value</span>
                  <span className="font-bold font-mono text-brand-400">
                    {pcurrency} {(pqty * pprice).toLocaleString()}
                  </span>
                </div>
                {pushErr && (
                  <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                    {pushErr}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn flex-1 justify-center"
                    onClick={closePush}
                    disabled={pushing}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary flex-1 justify-center"
                    onClick={handlePush}
                    disabled={pushing || !pqty || !pprice}
                  >
                    {pushing ? 'Creating…' : 'Create Listing'}
                  </button>
                </div>
              </div>
            )}

            {!canPush && !showPush && !pushDone && (
              <p className="text-xs text-text-muted text-center py-3">
                {batch.current_holder_id === user?.organizationId
                  ? 'You hold this batch'
                  : `Holder: ${batch.holder_name || 'Other organization'}`}
              </p>
            )}

            {canAttest && !showAttest && (
              <button
                className="btn btn-primary w-full justify-center mb-2"
                onClick={() => {
                  setAttCertId('');
                  setShowAttest(true);
                }}
              >
                <Shield size={14} /> Attest Batch
              </button>
            )}

            {showAttest && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">Attest Batch</h4>
                <div>
                  <label className="form-label">Certificate</label>
                  {batch.farm_id && canDo('certificate.read') ? (
                    <CertificatePicker
                      key={batch.farm_id}
                      farmId={batch.farm_id}
                      value={attCertId}
                      disabled={attesting}
                      onChange={(certificate) => setAttCertId(certificate?.id || '')}
                    />
                  ) : (
                    <p role="alert">
                      Certificate selection requires an accessible source farm and certificate
                      records.
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label">Notes (optional)</label>
                  <input
                    className="form-input"
                    value={attNotes}
                    onChange={(e) => setAttNotes(e.target.value)}
                    placeholder="e.g. Visual inspection passed"
                  />
                </div>
                {attErr && (
                  <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                    {attErr}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn flex-1 justify-center"
                    onClick={closeAtt}
                    disabled={attesting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary flex-1 justify-center"
                    onClick={handleAttest}
                    disabled={attesting || !attCertId}
                  >
                    {attesting ? 'Attesting…' : 'Confirm Attestation'}
                  </button>
                </div>
              </div>
            )}

            <button
              className="btn w-full justify-center mt-3 text-xs"
              onClick={() => navigate(`/farms/${batch.farm_id}`)}
            >
              View Farm →
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={publicationReview !== null}
        title="Review public product publication"
        message={
          publicationReview
            ? `Publish ${publicationReview.display_name} (${publicationReview.lot_code}) at /p/${publicationReview.slug}? This activates its permanent public QR destination and exposes the permitted product, origin, journey and safety information to anyone with the link. Public presentation does not establish independent certification. Check the draft before confirming.`
            : ''
        }
        confirmLabel="Confirm public publication"
        loading={profileBusy}
        error={publicationError}
        onConfirm={() => void handlePublishProfile()}
        onCancel={() => {
          if (!profileBusy) setPublicationReview(null);
        }}
      />
    </Layout>
  );
}
