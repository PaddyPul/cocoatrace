import { useEffect, useState } from 'react';
import { shipments } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { useUnsavedChanges } from '../shared/UnsavedChanges';
import { Link } from 'react-router-dom';
export interface TradeDocument {
  id: string;
  type: string;
  file_name?: string;
  validation_status?: string;
  malware_scan_status?: string;
  review_status?: string;
  uploader_organization_id?: string;
}
export interface DocumentContext {
  id: string;
  incoterm?: string;
  payment_plan?: string;
  payment_terms_status?: string;
  payment_request_id?: string;
  documents_presented_at?: string | null;
  security_status?: string;
  documents_submission_error_code?: string | null;
  current_milestone?: string;
  transport_document_reference?: string | null;
  shipment_id?: string;
  seller_organization_id?: string;
  buyer_organization_id?: string;
  transport_coordinator_organization_id?: string;
  documents?: TradeDocument[];
}
export function documentReadiness(contract: DocumentContext) {
  const required = ['commercial_invoice', 'packing_list', 'transport_document'];
  if (['CIF', 'CIP'].includes(String(contract.incoterm).toUpperCase()))
    required.push('insurance_certificate');
  const usable = (doc: TradeDocument) =>
    doc.validation_status === 'validated' &&
    doc.malware_scan_status === 'clean' &&
    doc.review_status !== 'rejected' &&
    (!doc.uploader_organization_id ||
      doc.uploader_organization_id === contract.seller_organization_id);
  const rows = required.map((type) => ({
    type,
    ready: (contract.documents || []).some((doc) => doc.type === type && usable(doc)),
  }));
  const blockers = rows
    .filter((row) => !row.ready)
    .map((row) => `Upload a validated, scan-clean seller ${row.type.split('_').join(' ')}.`);
  if (contract.payment_terms_status !== 'agreed')
    blockers.push('Buyer must confirm the payment protection plan.');
  if (
    ![
      'handed_over',
      'loaded',
      'departed',
      'arrived',
      'customs_cleared',
      'unloaded',
      'delivered',
    ].includes(contract.current_milestone || '')
  )
    blockers.push('Record physical handover or loading in transport progress.');
  if (!contract.transport_document_reference?.trim())
    blockers.push(
      'Transport arrangement: enter the transport-document reference. Uploading a file does not fill this reference.',
    );
  if (contract.payment_plan === 'bank_secured' && contract.security_status !== 'verified')
    blockers.push('Supplier must review and accept the external bank security.');
  return { rows, blockers };
}
export default function DocumentReadiness({
  contract,
  onRefresh,
}: {
  contract: DocumentContext;
  onRefresh?: () => Promise<unknown>;
}) {
  const { user, canDo } = useAuthCtx();
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [referenceMessage, setReferenceMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');
  useUnsavedChanges(Boolean(reference), 'Transport document reference');
  const saveReference = async () => {
    if (!contract.shipment_id || !reference.trim()) return;
    setSaving(true);
    setReferenceMessage('');
    try {
      await shipments.updateDetails(contract.shipment_id, {
        transportDocumentReference: reference.trim(),
      });
      setReference('');
      setReferenceMessage(
        'Transport reference saved. Automatic submission will check the document set.',
      );
      try {
        await onRefresh?.();
      } catch {
        setRefreshError('Reference saved; status refresh failed. Reload to read current status.');
      }
    } catch (error: unknown) {
      setReferenceMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the transport reference. Your entry has been retained.',
      );
    } finally {
      setSaving(false);
    }
  };
  const documentTriggered = ['deposit_balance', 'documentary_collection', 'bank_secured'].includes(
    contract.payment_plan || '',
  );
  useEffect(() => {
    if (!documentTriggered || contract.documents_presented_at || !onRefresh) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      onRefresh()
        .then(() => setRefreshError(''))
        .catch(() =>
          setRefreshError('Could not refresh document submission status. Reload to retry.'),
        );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [documentTriggered, contract.documents_presented_at, onRefresh]);
  const { rows, blockers } = documentReadiness(contract);
  return (
    <section
      aria-label="Document presentation checklist"
      className="rounded-2xl border border-border p-4 space-y-3"
    >
      <h3 className="font-semibold">Trade document checklist</h3>
      {rows.map((row) => (
        <p key={row.type} className="text-sm">
          {row.ready ? 'Ready' : 'Required'}: {row.type.split('_').join(' ')}
        </p>
      ))}
      {refreshError && <p role="alert">{refreshError}</p>}
      {!contract.documents_presented_at && contract.documents_submission_error_code && (
        <p role="status" className="rounded-xl bg-amber-400/10 p-3 text-sm">
          {contract.documents_submission_error_code === 'DOCUMENT_FILES_UNAVAILABLE'
            ? 'Automatic submission is waiting for usable stored documents. Check the file statuses below. If every file shows ready, ask platform operations to check private evidence availability or replace the unavailable file.'
            : contract.documents_submission_error_code === 'TRADE_REQUIREMENTS_INCOMPLETE'
              ? 'Automatic submission is waiting for trade requirements. Review the checklist, bank-security acceptance and any open payment issue.'
              : 'Automatic submission could not complete. Platform operations needs to review the failure. The server will retry; payment has not been activated by this failed attempt.'}
        </p>
      )}
      {!documentTriggered ? (
        <p>
          Documents are shared for this trade. Payment follows the agreed plan and is not triggered
          by this checklist.
        </p>
      ) : contract.documents_presented_at ? (
        <p role="status">Documents submitted. Continue with the recorded payment workflow.</p>
      ) : (
        <>
          <p className="text-sm">
            The system automatically submits a complete, eligible document set and activates the
            agreed document-triggered payment. No separate presentation click is required.
          </p>
          {blockers.length ? (
            <div role="status" className="rounded-xl bg-amber-400/10 p-3 text-sm">
              <strong>Before automatic submission:</strong>
              <ul className="list-disc pl-5">
                {blockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p role="status">
              Checklist complete. Awaiting the server’s availability and trade checks for automatic
              submission. This normally runs within 15 seconds; larger queues may take longer.
            </p>
          )}
          {!contract.transport_document_reference?.trim() &&
            contract.shipment_id &&
            contract.transport_coordinator_organization_id === user?.organizationId &&
            canDo('shipment.update') && (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveReference();
                }}
              >
                <label className="block text-sm">
                  Transport-document reference
                  <input
                    className="form-input"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    maxLength={200}
                    required
                  />
                </label>
                <p className="text-xs">
                  Enter the number printed on the waybill, bill of lading or consignment note. This
                  saves only the reference and preserves your other transport details.
                </p>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !reference.trim()}
                >
                  {saving ? 'Saving reference…' : 'Save transport reference'}
                </button>
              </form>
            )}
          {referenceMessage && <p role="status">{referenceMessage}</p>}
          {contract.shipment_id &&
            blockers.some(
              (reason) =>
                reason.startsWith('Transport arrangement:') || reason.startsWith('Record physical'),
            ) && (
              <Link className="btn btn-primary" to={`/shipments/${contract.shipment_id}`}>
                Complete transport details
              </Link>
            )}
        </>
      )}
      {contract.payment_request_id && contract.buyer_organization_id === user?.organizationId && (
        <Link className="btn" to={`/payments/${contract.payment_request_id}`}>
          Review goods payment or raise a document concern
        </Link>
      )}
      <p className="text-xs text-text-muted">
        A clean scan or a completed checklist does not certify document authenticity. Buyers can
        review accessible files and raise concerns; presentation follows the agreed payment plan.
      </p>
    </section>
  );
}
