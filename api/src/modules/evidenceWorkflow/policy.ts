export interface DownloadEvidenceItem {
  linked_entity_type: string;
  linked_entity_id: string;
  uploader_organization_id: string;
  buyer_organization_id: string | null;
  validation_status: string;
  review_status: string | null;
  malware_scan_status: string | null;
  type: string;
  release_status: string | null;
  storage_key: string | null;
  storage_provider: string | null;
  storage_path: string | null;
  detected_mime_type: string | null;
  mime_type: string | null;
  file_name: string;
}
export interface DownloadDenial {
  status: number;
  body: { error: string; code?: string };
}
const controlledDocuments = new Set(['transport_document', 'bill_of_lading', 'warehouse_release']);
export function downloadDenial(
  item: DownloadEvidenceItem | undefined,
  organizationId: string,
  entityAllowed: boolean,
): DownloadDenial | undefined {
  if (!item) return { status: 404, body: { error: 'Document not found' } };
  if (item.uploader_organization_id !== organizationId && !entityAllowed)
    return { status: 403, body: { error: 'You do not have access to this document' } };
  if (
    item.validation_status !== 'validated' ||
    item.review_status === 'rejected' ||
    item.malware_scan_status !== 'clean'
  )
    return {
      status: 423,
      body: {
        error: 'This document is unavailable until malware scanning completes',
        code: 'EVIDENCE_NOT_SCAN_CLEAN',
      },
    };
  if (
    item.buyer_organization_id === organizationId &&
    item.uploader_organization_id !== organizationId &&
    controlledDocuments.has(item.type) &&
    item.release_status !== 'authorized'
  )
    return {
      status: 423,
      body: {
        error:
          'This transport document is protected until the agreed payment release condition is satisfied',
      },
    };
  return undefined;
}
