import { useUnsavedChanges } from '../components/shared/UnsavedChanges';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import Layout from '../components/layout/Layout';
import SourcingCloseout from '../components/sourcing/SourcingCloseout';
import { sourcing } from '../api';
import type { StructuredSourcingBrief, SourcingRequest } from '../domains/marketplace/types';
import { useToast } from '../components/shared/ToastProvider';

const initialBrief =
  '20 metric tonnes of fully fermented organic cocoa beans from Ghana. Moisture maximum 7.5%, delivered to Rotterdam by 15 November 2026. Require plot-level origin and an EUDR data pack.';

export default function SourcingBriefPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const [savedRequest, setSavedRequest] = useState<SourcingRequest | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [retry, setRetry] = useState(0);
  const { toast } = useToast();
  const [brief, setBrief] = useState(initialBrief);
  const [structured, setStructured] = useState<StructuredSourcingBrief | null>(null);
  const [title, setTitle] = useState('');
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState('');
  const [origins, setOrigins] = useState('');
  const [delivery, setDelivery] = useState('');
  const [incoterm, setIncoterm] = useState('CIF');
  const [requiredBy, setRequiredBy] = useState('');
  const [deadline, setDeadline] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [organic, setOrganic] = useState(false);
  const [plotGeolocation, setPlotGeolocation] = useState(false);
  const [eudr, setEudr] = useState(false);
  const [visibility, setVisibility] = useState<'matched' | 'private' | 'invited'>('matched');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [edited, setEdited] = useState(false);
  const clearUnsaved = useUnsavedChanges(edited, 'Sourcing brief');

  useEffect(() => {
    let active = true;
    if (!requestId) {
      setSavedRequest(null);
      setStructured(null);
      setBrief(initialBrief);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setSavedRequest(null);
    sourcing
      .page({ mine: 'true', id: requestId, limit: '1' })
      .then((page) => {
        const row = page.items[0];
        if (!row || page.hasMore || page.nextCursor !== null)
          throw new Error('Saved brief is unavailable to this workspace.');
        if (!active) return;
        setTitle(row.title);
        setBrief('');
        setCommodity(row.commodity);
        setQuantity(String(row.quantity_kg));
        setOrigins((row.origin_countries || []).join(', '));
        setDelivery(row.delivery_location);
        setIncoterm(row.incoterm);
        setRequiredBy(row.required_by?.slice(0, 10) || '');
        setDeadline(
          row.offer_deadline
            ? new Date(
                new Date(row.offer_deadline).getTime() -
                  new Date(row.offer_deadline).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)
            : '',
        );
        setQualityNotes(String(row.quality_requirements?.notes || ''));
        setOrganic(Boolean(row.assurance_requirements?.organic));
        setPlotGeolocation(Boolean(row.assurance_requirements?.plotGeolocation));
        setEudr(Boolean(row.assurance_requirements?.eudrDataPack));
        setVisibility(row.visibility as 'private' | 'matched' | 'invited');
        setSavedRequest(row);
        setEdited(false);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Saved brief could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestId, retry]);
  const structure = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await sourcing.structure(brief);
      setEdited(true);
      setStructured(result);
      setCommodity(result.commodity);
      setQuantity(result.quantityKg ? String(result.quantityKg) : '');
      setOrigins(result.originCountries.join(', '));
      setDelivery(result.deliveryLocation);
      setIncoterm(result.incoterm);
      setRequiredBy(result.requiredBy);
      setQualityNotes(
        Object.entries(result.qualityRequirements)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; '),
      );
      setOrganic(Boolean(result.assuranceRequirements.organic));
      setPlotGeolocation(Boolean(result.assuranceRequirements.plotGeolocation));
      setEudr(Boolean(result.assuranceRequirements.eudrDataPack));
    } catch (err: any) {
      setError(err.message || 'Could not structure the brief');
    } finally {
      setBusy(false);
    }
  };
  const requirements = useMemo(
    () => [
      {
        title: 'Commodity and quantity',
        detail: `${commodity || 'Not identified'} · ${quantity ? `${Number(quantity).toLocaleString()} kg` : 'quantity required'}${origins ? ` · ${origins}` : ''}`,
        ok: Boolean(commodity && Number(quantity)),
      },
      {
        title: 'Quality specification',
        detail: qualityNotes || 'No explicit quality specification extracted; add one if needed.',
        ok: true,
      },
      {
        title: 'Assurance package',
        detail:
          [
            organic && 'Organic evidence',
            plotGeolocation && 'Plot geolocation',
            eudr && 'EUDR data pack',
          ]
            .filter(Boolean)
            .join(' · ') || 'Conventional supply; no special assurance selected',
        ok: true,
      },
      {
        title: 'Commercial delivery',
        detail: `${incoterm} ${delivery || 'location required'}${requiredBy ? ` · required ${requiredBy}` : ''}`,
        ok: Boolean(delivery),
      },
    ],
    [
      commodity,
      quantity,
      origins,
      qualityNotes,
      organic,
      plotGeolocation,
      eudr,
      incoterm,
      delivery,
      requiredBy,
    ],
  );
  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      if (!structured && !savedRequest)
        throw new Error('Structure and review the requirements before continuing.');
      const missing = [
        !commodity.trim() && 'Commodity or material',
        (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) &&
          'Quantity greater than zero (kg)',
        !delivery.trim() && 'Delivery location',
      ].filter(Boolean);
      if (missing.length) throw new Error(`Complete these reviewed fields: ${missing.join(', ')}.`);
      const status = visibility === 'private' ? 'draft' : 'open';
      const data = {
        title: title || `${organic ? 'Organic ' : ''}${commodity} for ${delivery}`,
        commodity: commodity.trim().toLowerCase(),
        quantityKg: Number(quantity),
        originCountries: origins
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
        qualityRequirements: { ...savedRequest?.quality_requirements, notes: qualityNotes },
        assuranceRequirements: {
          ...savedRequest?.assurance_requirements,
          organic,
          plotGeolocation,
          eudrDataPack: eudr,
        },
        deliveryLocation: delivery,
        incoterm,
        requiredBy: requiredBy || undefined,
        offerDeadline: deadline ? new Date(deadline).toISOString() : undefined,
        visibility,
        status,
      } as const;
      const request = savedRequest
        ? await sourcing.update(savedRequest.id, {
            ...data,
            requiredBy: requiredBy || null,
            offerDeadline: data.offerDeadline || null,
          })
        : await sourcing.create(data);
      try {
        localStorage.setItem('ct_active_sourcing_request', request.id);
      } catch {
        /* URL remains the authoritative matching context. */
      }
      toast(
        'success',
        status === 'draft'
          ? 'Private sourcing draft saved.'
          : 'Sourcing request published with your reviewed requirements.',
      );
      setEdited(false);
      clearUnsaved();
      navigate(status === 'draft' ? '/home?mode=buy' : `/marketplace?request=${request.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not publish sourcing request');
    } finally {
      setBusy(false);
    }
  };

  if (requestId && (loading || !savedRequest || savedRequest.id !== requestId))
    return (
      <Layout currentPage="source-new">
        <div>
          {loading ? (
            <p role="status">Loading saved brief…</p>
          ) : (
            <div role="alert">
              {error}
              <button className="btn" onClick={() => setRetry((value) => value + 1)}>
                Retry saved brief
              </button>
            </div>
          )}
        </div>
      </Layout>
    );
  if (savedRequest && !['draft', 'open'].includes(savedRequest.status))
    return (
      <Layout currentPage="source-new">
        <div className="space-y-5">
          <h2 className="text-2xl font-bold">{savedRequest.title}</h2>
          <p>
            {savedRequest.commodity} · {Number(savedRequest.quantity_kg).toLocaleString()} kg ·{' '}
            {savedRequest.status}
          </p>
          <p>
            This request is closed to further editing. Existing trade agreements continue
            independently.
          </p>
          <SourcingCloseout request={savedRequest} onClosed={setSavedRequest} />
          <button className="btn" onClick={() => navigate('/home?mode=buy')}>
            Back to workspace
          </button>
        </div>
      </Layout>
    );
  return (
    <Layout
      currentPage="source-new"
      actions={
        <button className="btn" onClick={() => navigate('/home?mode=buy')}>
          <ArrowLeft size={14} />
          Back to workspace
        </button>
      }
    >
      {savedRequest && (
        <div className="mb-6">
          <SourcingCloseout request={savedRequest} onClosed={setSavedRequest} />
        </div>
      )}
      <div
        onChangeCapture={() => setEdited(true)}
        className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]"
      >
        <section>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-400">
            Describe the outcome
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">
            {savedRequest ? 'Edit saved sourcing brief' : 'What do you need to buy?'}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
            Write the need in ordinary procurement language. BetterTrade extracts editable
            requirements and flags anything it could not identify.
          </p>
          <div className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <label htmlFor="sourcingbrief-sourcing-brief" className="form-label">
              Sourcing brief
            </label>
            <textarea
              id="sourcingbrief-sourcing-brief"
              aria-label="Sourcing brief"
              className="form-input min-h-36 resize-y leading-6"
              value={brief}
              onChange={(event) => {
                setBrief(event.target.value);
                setStructured(null);
              }}
            />
            <button className="btn btn-primary mt-4" disabled={busy} onClick={structure}>
              <Sparkles size={15} />
              {busy
                ? 'Structuring…'
                : structured
                  ? 'Restructure requirements'
                  : 'Structure requirements'}
            </button>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface-darker p-4 text-xs leading-5 text-text-muted">
            <LockKeyhole size={16} className="mt-0.5 shrink-0 text-brand-400" />
            Only the reviewed fields are published. The original text never overrides your edits.
          </div>
        </section>
        <section className="space-y-4">
          <div className="rounded-3xl border border-brand-400/20 bg-[linear-gradient(145deg,rgba(109,190,90,.1),rgba(255,255,255,.02))] p-5 sm:p-6">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-400 text-emerald-950">
                <Sparkles size={18} />
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">
                  Structured requirements
                </div>
                <h3 className="mt-1 text-lg font-bold">Review every extracted fact</h3>
              </div>
            </div>
            {structured && (
              <>
                <div className="mt-5 space-y-2">
                  {requirements.map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-3 rounded-2xl border border-border bg-surface-darker p-4"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.ok ? 'bg-brand-400/10 text-brand-400' : 'bg-amber-300/10 text-amber-300'}`}
                      >
                        {item.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                      </span>
                      <div>
                        <div className="text-xs font-semibold">{item.title}</div>
                        <div className="mt-1 text-[11px] leading-5 text-text-muted">
                          {item.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {structured.unresolved.length > 0 && (
                  <div className="mt-3 text-[10px] text-amber-300">
                    Review needed: {structured.unresolved.join(', ')}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-400">
              Editable request
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Request title">
                <input
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Generated from commodity and destination when blank"
                />
              </Field>
              <Field label="Commodity or material">
                <input
                  className="form-input"
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                />
              </Field>
              <Field label="Quantity (kg)">
                <input
                  className="form-input"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="Origin country codes">
                <input
                  className="form-input"
                  placeholder="GH, CI"
                  value={origins}
                  onChange={(e) => setOrigins(e.target.value)}
                />
              </Field>
              <Field label="Incoterm">
                <select
                  aria-label="Incoterm"
                  className="form-select"
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                >
                  {['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].map(
                    (term) => (
                      <option key={term}>{term}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Delivery location">
                <input
                  className="form-input"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                />
              </Field>
              <Field label="Required by">
                <input
                  className="form-input"
                  type="date"
                  value={requiredBy}
                  onChange={(e) => setRequiredBy(e.target.value)}
                />
              </Field>
              <Field label="Offer deadline">
                <input
                  className="form-input"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
              <Field label="Visibility">
                <select
                  aria-label="Visibility"
                  className="form-select"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                >
                  <option value="matched">Matched suppliers</option>
                  <option value="private">Private draft</option>
                  {savedRequest?.visibility === 'invited' && (
                    <option value="invited">Invited suppliers</option>
                  )}
                </select>
              </Field>
            </div>
            <div className="mt-4 block">
              <label className="form-label" htmlFor="sourcing-quality-requirements">
                Quality requirements
              </label>
              <textarea
                id="sourcing-quality-requirements"
                className="form-input min-h-20"
                value={qualityNotes}
                onChange={(e) => setQualityNotes(e.target.value)}
                placeholder="Grade, moisture, specification or tests"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <CheckField checked={organic} set={setOrganic} label="Organic evidence" />
              <CheckField
                checked={plotGeolocation}
                set={setPlotGeolocation}
                label="Plot geolocation"
              />
              <CheckField checked={eudr} set={setEudr} label="EUDR data pack" />
            </div>
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300"
              >
                {error}
              </div>
            )}
            <button
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 text-sm font-bold text-emerald-950 disabled:opacity-50"
              onClick={publish}
              disabled={busy || (!structured && !savedRequest)}
            >
              {savedRequest
                ? 'Save reviewed changes'
                : visibility === 'private'
                  ? 'Save private draft'
                  : 'Find matching supply'}{' '}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </Layout>
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
function CheckField({
  checked,
  set,
  label,
}: {
  checked: boolean;
  set: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="btn cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => set(e.target.checked)}
        className="accent-[#7dcc61]"
      />
      {label}
    </label>
  );
}
