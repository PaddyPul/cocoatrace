import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { evidence, EvidenceRecordOption } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import EvidenceRecordPicker from '../components/catalog/EvidenceRecordPicker';

type RecordKind = 'farm' | 'batch' | 'contract' | 'shipment';
const sources = {
  farm: { label: 'Source farm (including its plots)', permission: 'farm.read' },
  batch: { label: 'Batch or conventional inventory', permission: 'batch.read' },
  contract: { label: 'Trade contract', permission: 'contract.read' },
  shipment: { label: 'Shipment', permission: 'shipment.read' },
};
const purposes = [
  ['origin_document', 'Origin or plot evidence'],
  ['certificate_pdf', 'External certificate or assurance evidence'],
  ['weighing_ticket', 'Quantity or weighing evidence'],
  ['quality_report', 'Quality or inspection report'],
  ['other', 'Other supporting evidence'],
] as const;

export default function EvidenceContributionPage() {
  const { user, canDo } = useAuthCtx();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedKind = params.get('entityType');
  const kinds = (Object.keys(sources) as RecordKind[]).filter((kind) =>
    canDo(sources[kind].permission),
  );
  const [kind, setKind] = useState<RecordKind>(
    kinds.find((value) => value === requestedKind) || kinds[0] || 'farm',
  );
  const [selected, setSelected] = useState<EvidenceRecordOption | null>(null);
  const [ready, setReady] = useState(false);
  const recordId = selected?.id || '';
  const [purpose, setPurpose] = useState('origin_document');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const chooseRecord = useCallback((record: EvidenceRecordOption | null) => {
    setSelected(record);
    setDescription('');
    setFile(undefined);
    setError('');
    setSuccess('');
  }, []);
  const upload = async () => {
    if (!selected || !ready || !file || !description.trim() || busy) return;
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
                  onChange={(event) => {
                    chooseRecord(null);
                    setReady(false);
                    setKind(event.target.value as RecordKind);
                  }}
                >
                  {kinds.map((value) => (
                    <option key={value} value={value}>
                      {sources[value].label}
                    </option>
                  ))}
                </select>
              </label>
              <EvidenceRecordPicker
                key={`${user?.id}:${kind}:${params.get('entityId') || ''}`}
                kind={kind}
                selected={selected}
                requestedId={requestedKind === kind ? params.get('entityId') || '' : ''}
                onChange={chooseRecord}
                onReady={setReady}
                disabled={busy}
                onDashboard={() => navigate('/home')}
              />
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
                    disabled={!ready || busy || !file || !description.trim()}
                    onClick={upload}
                  >
                    {busy ? 'Uploading…' : 'Attach evidence'}
                  </button>
                </div>
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
