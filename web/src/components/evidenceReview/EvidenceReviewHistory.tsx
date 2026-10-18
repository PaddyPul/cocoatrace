import { useUnsavedChanges, useDiscardChanges } from '../shared/UnsavedChanges';
import { useCallback, useEffect, useId, useState } from 'react';
import { evidence } from '../../api/evidence';
import { evidenceReview, ReviewDetail } from '../../api/evidenceReview';
import { useAuthCtx } from '../auth/AuthProvider';
export default function EvidenceReviewHistory({
  evidenceId,
  reviewer = false,
  onChanged,
  onClose,
}: {
  evidenceId: string;
  reviewer?: boolean;
  onChanged?: () => void;
  onClose?: () => void;
}) {
  const { user, canDo } = useAuthCtx();
  const labelId = useId();
  const [uploadedId, setUploadedId] = useState('');
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState(''),
    [reason, setReason] = useState(''),
    [decision, setDecision] = useState('approved'),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [claim, setClaim] = useState('');
  useUnsavedChanges(
    Boolean(reason || decision !== 'approved' || confirmed || file || claim || uploadedId),
    'Document review or replacement',
  );
  const discard = useDiscardChanges(
    Boolean(reason || decision !== 'approved' || confirmed || file || claim || uploadedId),
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setConfirmed(false);
    try {
      setDetail(await evidenceReview.detail(evidenceId));
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : 'Review history unavailable.');
    } finally {
      setLoading(false);
    }
  }, [evidenceId]);
  useEffect(() => {
    setReason('');
    setClaim('');
    setFile(null);
    setUploadedId('');
    setNotice('');
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      void load();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);
  async function submit() {
    if (!detail || !confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await evidenceReview.decide(evidenceId, decision, reason, detail.fingerprint);
      setNotice('Document decision recorded. Claim assurance remains separate.');
      setReason('');
      setDecision('approved');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  async function replace() {
    if (!detail || !file || !claim.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const uploaded: unknown = uploadedId
        ? { id: uploadedId }
        : await evidence.upload(file, {
            type: detail.evidence.type,
            linkedEntityType: detail.evidence.linked_entity_type,
            linkedEntityId: detail.evidence.linked_entity_id,
            claimDescription: claim,
          });
      const id = uploaded && typeof uploaded === 'object' && 'id' in uploaded ? uploaded.id : null;
      if (typeof id !== 'string')
        throw new Error(
          'Upload response missing evidence identity. Refresh before retrying; do not upload twice.',
        );
      setUploadedId(id);
      await evidenceReview.replace(evidenceId, id, detail.fingerprint);
      setNotice(
        'Replacement linked as a separate pending record. The original file and review remain retained.',
      );
      setFile(null);
      setUploadedId('');
      setClaim('');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replacement failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Document review history"
      className="space-y-4 rounded-xl border border-border p-4"
    >
      <h2 className="text-lg font-bold">Document review history</h2>
      {onClose && (
        <button className="btn" onClick={() => discard(onClose)}>
          Close document history
        </button>
      )}
      <p className="text-sm">
        Document approval does not certify organic status, origin, EUDR compliance or publication.
        Malware scanning and protected document release remain separate.
      </p>
      <button
        className="btn"
        disabled={loading || busy}
        onClick={() => {
          void load();
        }}
      >
        Refresh document review
      </button>
      {loading && <p role="status">Refreshing document review…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {detail && (
        <>
          <p>
            {detail.evidence.file_name} · {detail.evidence.review_status}
          </p>
          <p className="break-all text-xs">Source hash: {detail.evidence.sha256_hash}</p>
          <button
            className="btn"
            onClick={() => {
              void evidence
                .download(evidenceId, detail.evidence.file_name)
                .catch((e) => setError(e.message));
            }}
          >
            Download retained file
          </button>
          {detail.replacements.map((row) => (
            <p key={row.id}>
              Linked replacement: {row.file_name} · {row.review_status}{' '}
              <button
                className="btn"
                onClick={() => {
                  void evidence.download(row.id, row.file_name).catch((e) => setError(e.message));
                }}
              >
                Download {row.file_name}
              </button>
            </p>
          ))}
          {detail.history.length ? (
            <ol>
              {detail.history.map((row) => (
                <li key={row.id} className="border-t border-border py-2">
                  <strong>{row.decision}</strong>
                  <p>{row.reason}</p>
                  <p className="text-xs">
                    Reviewer {row.actor_user_id} · {row.created_at}
                  </p>
                  <p className="break-all text-xs">Reviewed hash: {row.source_hash}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>No document decision recorded. This is not approval.</p>
          )}
          {reviewer && user?.permissions.includes('*') && (
            <div role="group" aria-label="Record a document review" className="space-y-3">
              <label htmlFor={`${labelId}-decision`}>Document decision</label>
              <select
                id={`${labelId}-decision`}
                className="form-select"
                value={decision}
                onChange={(e) => {
                  setDecision(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="approved">Approve document</option>
                <option value="rejected">Reject document</option>
              </select>
              <label htmlFor={`${labelId}-reason`}>Document review reason</label>
              <textarea
                id={`${labelId}-reason`}
                className="form-input"
                value={reason}
                maxLength={2000}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirmed(false);
                }}
              />
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                I reviewed this exact file and hash.
              </label>
              <button
                className="btn btn-primary"
                disabled={busy || loading || !confirmed || !reason.trim()}
                onClick={() => {
                  void submit();
                }}
              >
                Record document decision
              </button>
            </div>
          )}
          {canDo('evidence.upload') &&
            user?.organizationId === detail.evidence.uploader_organization_id && (
              <div role="group" aria-label="Upload replacement" className="space-y-3">
                {uploadedId && (
                  <p role="status">
                    File uploaded. Retrying links the existing upload; no duplicate upload is
                    created.
                  </p>
                )}
                <p>
                  Upload a new record for the same claim. Previous decisions do not transfer to the
                  replacement.
                </p>
                <label htmlFor={`${labelId}-file`}>Replacement file</label>
                <input
                  id={`${labelId}-file`}
                  type="file"
                  disabled={Boolean(uploadedId)}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor={`${labelId}-claim`}>Replacement claim explanation</label>
                <textarea
                  id={`${labelId}-claim`}
                  className="form-input"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  maxLength={2000}
                />
                <button
                  className="btn"
                  disabled={busy || loading || !file || !claim.trim()}
                  onClick={() => {
                    void replace();
                  }}
                >
                  Upload and link replacement
                </button>
              </div>
            )}
        </>
      )}
    </section>
  );
}
