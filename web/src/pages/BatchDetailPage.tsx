import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { batches as batchesApi, certificates as certificatesApi } from '../api';
import { Batch, Evidence, Certificate } from '../types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Shield, FileText, ChevronRight } from 'lucide-react';
import { SkeletonDetail } from '../components/shared/Skeleton';

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showPush, setShowPush] = useState(false);
  const [pqty, setPqty] = useState(0);
  const [pprice, setPprice] = useState(0);
  const [porigin, setPorigin] = useState('');
  const [pdest, setPdest] = useState('');
  const [pincoterm, setPincoterm] = useState('CIF');
  const [pushing, setPushing] = useState(false);
  const [pushDone, setPushDone] = useState(false);
  const [pushErr, setPushErr] = useState('');

  const [showAttest, setShowAttest] = useState(false);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [attCertId, setAttCertId] = useState('');
  const [attNotes, setAttNotes] = useState('');
  const [attesting, setAttesting] = useState(false);
  const [attErr, setAttErr] = useState('');

  const canAttest = batch ? (batch.organic_claim_status === 'pending_attestation' && canDo('batch.attest')) : false;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    batchesApi.get(id)
      .then((d) => {
        setBatch(d.batch);
        setEvidence(d.evidence || []);
        setPqty(d.batch.quantity_kg || 0);
        setPorigin(d.batch.region ? `${d.batch.region}, Ghana` : 'Tema, Ghana');
        setPdest('Rotterdam, Netherlands');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (showAttest && batch) {
      certificatesApi.list(batch.farm_id).then(setCerts).catch(() => {});
    }
  }, [showAttest, batch]);

  const handleAttest = async () => {
    if (!batch || !attCertId) { setAttErr('Select a certificate'); return; }
    setAttesting(true); setAttErr('');
    try {
      await batchesApi.attest(batch.id, { certificateId: attCertId, notes: attNotes || undefined });
      setShowAttest(false);
      toast('success', 'Batch attested successfully');
      const d = await batchesApi.get(batch.id);
      setBatch(d.batch);
      setEvidence(d.evidence || []);
    } catch (e: any) { setAttErr(e.message); } finally { setAttesting(false); }
  };

  const canPush = batch ? (batch.current_holder_id === user?.organizationId && canDo('batch.create')) : false;

  const handlePush = async () => {
    if (!batch || !pqty || pqty <= 0 || !pprice || pprice <= 0) { setPushErr('Quantity and price required'); return; }
    setPushing(true); setPushErr('');
    try {
      await batchesApi.pushToMarketplace(batch.id, {
        quantityKg: Number(pqty), pricePerKg: Number(pprice),
        currency: 'EUR', incoterm: pincoterm,
        originLocation: porigin, destinationLocation: pdest,
      });
      setPushDone(true);
      toast('success', 'Batch listed on marketplace');
    } catch (e: any) { setPushErr(e.message); } finally { setPushing(false); }
  };

  if (loading) return <Layout currentPage="batch"><SkeletonDetail /></Layout>;
  if (error || !batch) return <Layout currentPage="batch"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Batch not found'}</div></Layout>;

  return (
    <Layout currentPage="batch" actions={<button className="btn btn-sm" onClick={() => navigate('/batches')}><ArrowLeft size={14} /> Back</button>}>
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
              <h1 className="text-xl font-bold text-text-primary mb-1">Batch {batch.id.slice(0, 8)}…</h1>
              <p className="text-sm text-text-muted">{batch.farm_name || 'Unknown farm'} · {batch.crop}{batch.region ? ` · ${batch.region}` : ''}</p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Harvest Date</div>
                  <div className="font-medium">{fmtDate(batch.harvest_date)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</div>
                  <div className="font-medium font-mono">{(batch.quantity_kg || 0).toLocaleString()} kg</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Holder</div>
                  <div className="font-medium">{batch.holder_name || batch.current_holder_id?.slice(0, 8)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Crop</div>
                  <div className="font-medium">{batch.crop || 'cocoa'}</div>
                </div>
              </div>
            </div>
          </div>

          {batch.att_hash && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield size={16} className="text-brand-400" /> Attestation</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Provenance Hash</div>
                  <div className="font-mono text-[10px] text-text-muted break-all">{batch.att_hash}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Attested At</div>
                  <div>{batch.attested_at ? fmtDate(batch.attested_at) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Certificate</div>
                  <div>{batch.standard || '—'} {batch.cert_standard ? `(${batch.cert_standard})` : ''}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Valid Until</div>
                  <div>{batch.cert_valid_to ? fmtDate(batch.cert_valid_to) : '—'}</div>
                </div>
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="bg-surface border border-border rounded p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText size={16} className="text-brand-400" /> Evidence ({evidence.length})</h3>
              <div className="space-y-2">
                {evidence.map((e) => (
                  <div key={e.id} className="bg-surface-darker border border-border rounded p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-medium">{e.file_name}</div>
                      <div className="text-text-muted">{(e.type || '').replace(/_/g, ' ')} · {e.sha256_hash?.slice(0, 16)}…</div>
                    </div>
                    <StatusBadge status={e.review_status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded p-5 sticky top-6">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Actions</div>

            {canPush && !showPush && !pushDone && (
              <button className="btn btn-primary w-full justify-center mb-2" onClick={() => setShowPush(true)}>
                List on Marketplace
              </button>
            )}

            {pushDone && (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-sm font-semibold text-brand-400 mb-1">Listed!</div>
                <button className="btn btn-sm mt-2" onClick={() => navigate('/marketplace')}>
                  View Marketplace <ChevronRight size={14} />
                </button>
              </div>
            )}

            {showPush && !pushDone && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">Create Listing</h4>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input type="number" className="form-input" value={pqty} onChange={(e) => setPqty(Number(e.target.value))} max={batch.quantity_kg} />
                </div>
                <div>
                  <label className="form-label">Price per kg (€)</label>
                  <input type="number" step="0.01" className="form-input" value={pprice} onChange={(e) => setPprice(Number(e.target.value))} />
                </div>
                <div>
                  <label className="form-label">Origin</label>
                  <input className="form-input" value={porigin} onChange={(e) => setPorigin(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Destination</label>
                  <input className="form-input" value={pdest} onChange={(e) => setPdest(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Incoterm</label>
                  <select className="form-select" value={pincoterm} onChange={(e) => setPincoterm(e.target.value)}>
                    <option>CIF</option><option>FOB</option><option>EXW</option><option>DDP</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
                  <span className="text-text-muted">Value</span>
                  <span className="font-bold font-mono text-brand-400">€{(pqty * pprice).toLocaleString()}</span>
                </div>
                {pushErr && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{pushErr}</div>}
                <div className="flex gap-2">
                  <button className="btn flex-1 justify-center" onClick={() => setShowPush(false)} disabled={pushing}>Cancel</button>
                  <button className="btn btn-primary flex-1 justify-center" onClick={handlePush} disabled={pushing || !pqty || !pprice}>
                    {pushing ? 'Creating…' : 'Create Listing'}
                  </button>
                </div>
              </div>
            )}

            {!canPush && !showPush && !pushDone && (
              <p className="text-xs text-text-muted text-center py-3">
                {batch.current_holder_id === user?.organizationId ? 'You hold this batch' : `Holder: ${batch.holder_name || 'Other organization'}`}
              </p>
            )}

            {canAttest && !showAttest && (
              <button className="btn btn-primary w-full justify-center mb-2" onClick={() => setShowAttest(true)}>
                <Shield size={14} /> Attest Batch
              </button>
            )}

            {showAttest && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">Attest Batch</h4>
                <div>
                  <label className="form-label">Certificate</label>
                  <select className="form-select" value={attCertId} onChange={(e) => setAttCertId(e.target.value)}>
                    <option value="">Select certificate…</option>
                    {certs.filter((c) => c.status === 'active').map((c) => (
                      <option key={c.id} value={c.id}>{c.standard} — {fmtDate(c.valid_from)} to {fmtDate(c.valid_to)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-input" value={attNotes} onChange={(e) => setAttNotes(e.target.value)} placeholder="e.g. Visual inspection passed" />
                </div>
                {attErr && <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{attErr}</div>}
                <div className="flex gap-2">
                  <button className="btn flex-1 justify-center" onClick={() => { setShowAttest(false); setAttErr(''); }} disabled={attesting}>Cancel</button>
                  <button className="btn btn-primary flex-1 justify-center" onClick={handleAttest} disabled={attesting || !attCertId}>
                    {attesting ? 'Attesting…' : 'Confirm Attestation'}
                  </button>
                </div>
              </div>
            )}

            <button className="btn w-full justify-center mt-3 text-xs" onClick={() => navigate(`/farms/${batch.farm_id}`)}>View Farm →</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
