import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { batches, contracts, evidence, farms, shipments } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import SupplyPathChoice from '../components/supply/SupplyPathChoice';

type RecordKind = 'farm' | 'batch' | 'contract' | 'shipment';
type Option = { id: string; label: string };
const sources = {
  farm: {
    label: 'Source farm (including its plots)',
    permission: 'farm.read',
    load: async () => (await farms.list()).map((row) => ({ id: row.id, label: row.name })),
  },
  batch: {
    label: 'Batch or conventional inventory',
    permission: 'batch.read',
    load: async () =>
      (await batches.list()).map((row) => ({
        id: row.id,
        label: `${row.crop || 'Material'} · ${row.id.slice(0, 8)}`,
      })),
  },
  contract: {
    label: 'Trade contract',
    permission: 'contract.read',
    load: async () =>
      (await contracts.list()).map((row) => ({
        id: row.id,
        label: `${row.id.slice(0, 8)} · ${row.status}`,
      })),
  },
  shipment: {
    label: 'Shipment',
    permission: 'shipment.read',
    load: async () =>
      (await shipments.list()).map((row) => ({
        id: row.id,
        label: `${row.id.slice(0, 8)} · ${row.current_milestone || 'Planning'}`,
      })),
  },
} satisfies Record<
  RecordKind,
  { label: string; permission: string; load: () => Promise<Option[]> }
>;
const purposes = [
  ['origin_document', 'Origin or plot evidence'],
  ['certificate_pdf', 'External certificate or assurance evidence'],
  ['weighing_ticket', 'Quantity or weighing evidence'],
  ['quality_report', 'Quality or inspection report'],
  ['other', 'Other supporting evidence'],
] as const;

export default function EvidenceContributionPage() {
  const { canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedKind = params.get('entityType');
  const kinds = (Object.keys(sources) as RecordKind[]).filter((kind) =>
    canDo(sources[kind].permission),
  );
  const [kind, setKind] = useState<RecordKind>(
    kinds.find((value) => value === requestedKind) || kinds[0] || 'farm',
  );
  const [records, setRecords] = useState<Option[]>([]);
  const [recordId, setRecordId] = useState('');
  const [purpose, setPurpose] = useState('origin_document');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    setDescription('');
    setLoading(true);
    setRecords([]);
    setRecordId('');
    setFile(undefined);
    setError('');
    setSuccess('');
    if (!canDo(sources[kind].permission)) {
      setLoading(false);
      return;
    }
    sources[kind]
      .load()
      .then((rows) => {
        if (!active) return;
        setRecords(rows);
        const requested = params.get('entityId');
        if (requested && rows.some((row) => row.id === requested)) setRecordId(requested);
      })
      .catch(() => {
        if (active)
          setError('Records could not be loaded. Reload to retry; no upload was started.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, params]);
  const selected = records.find((record) => record.id === recordId);
  const upload = async () => {
    if (!selected || !file || !description.trim() || busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await evidence.upload(file, {
        type: purpose,
        linkedEntityType: kind,
        linkedEntityId: selected.id,
        claimDescription: description.trim(),
      });
      setSuccess(
        `Evidence attached to ${selected.label}. Uploading does not approve the claim; scanning and review status remain separate.`,
      );
      setFile(undefined);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Upload failed. Review the error before retrying.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Layout currentPage="evidence">
      <section className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">Add evidence to a record</h1>
        <p className="text-sm text-text-muted">
          Choose what this document supports before uploading. For plot evidence, choose its source
          farm and name the plot in your explanation. Uploading is not certification.
        </p>
        {!canDo('evidence.upload') || kinds.length === 0 ? (
          <p role="status">
            Your account cannot upload evidence. Ask an authorized colleague to contribute to the
            relevant record.
          </p>
        ) : (
          <>
            <fieldset disabled={busy} className="space-y-4">
              <label className="block">
                Record type
                <select
                  aria-label="Evidence record type"
                  className="form-select mt-2"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as RecordKind)}
                >
                  {kinds.map((value) => (
                    <option key={value} value={value}>
                      {sources[value].label}
                    </option>
                  ))}
                </select>
              </label>
              {loading ? (
                <p role="status">Loading permitted records…</p>
              ) : !error && records.length === 0 ? (
                <>
                  <p role="status">
                    No {sources[kind].label.toLowerCase()} records are available. Create the
                    relevant source or inventory record first, or ask your trade colleague to create
                    it.
                  </p>
                  {kind === 'farm' || kind === 'batch' ? (
                    <SupplyPathChoice />
                  ) : (
                    <button className="btn" onClick={() => navigate('/home')}>
                      Return to trade dashboard
                    </button>
                  )}
                </>
              ) : null}
              {!loading && records.length > 0 && (
                <>
                  <label className="block">
                    Choose record
                    <select
                      aria-label="Evidence record"
                      className="form-select mt-2"
                      value={recordId}
                      onChange={(event) => {
                        setDescription('');
                        setRecordId(event.target.value);
                        setFile(undefined);
                        setSuccess('');
                      }}
                    >
                      <option value="">Select the record this evidence supports</option>
                      {records.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected && (
                    <div
                      data-testid="evidence-context"
                      className="rounded-2xl border border-border p-5 space-y-4"
                    >
                      <p>
                        Supporting record: <strong>{selected.label}</strong>
                      </p>
                      <label className="block">
                        Document purpose
                        <select
                          aria-label="Document purpose"
                          className="form-select mt-2"
                          value={purpose}
                          onChange={(event) => setPurpose(event.target.value)}
                        >
                          {purposes.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        What does this evidence support?
                        <textarea
                          aria-label="Evidence explanation"
                          className="form-input mt-2"
                          maxLength={2000}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Describe the claim, source or plot code, and any requested requirement."
                        />
                      </label>
                      <label className="block">
                        Evidence file (PDF, JPEG or PNG)
                        <input
                          key={`${kind}:${recordId}:${success}`}
                          aria-label="Evidence file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="form-input mt-2"
                          onChange={(event) => setFile(event.target.files?.[0])}
                        />
                      </label>
                      <button
                        className="btn btn-primary"
                        disabled={!file || !description.trim()}
                        onClick={upload}
                      >
                        {busy ? 'Uploading…' : 'Attach evidence'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </fieldset>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-brand-300">
            {success}
          </p>
        )}
        <button className="btn" onClick={() => navigate('/evidence')}>
          View evidence documents
        </button>
      </section>
    </Layout>
  );
}
