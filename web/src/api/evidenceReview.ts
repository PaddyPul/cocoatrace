import { api } from './http';
import type { CatalogPage } from './http';
export type ReviewEvidence = {
  id: string;
  type: string;
  file_name: string;
  sha256_hash: string;
  linked_entity_type: string;
  linked_entity_id: string;
  uploader_organization_id: string;
  review_status: string;
  review_revision: number;
  fingerprint: string;
  created_at: string;
};
export type ReviewDetail = {
  evidence: ReviewEvidence;
  fingerprint: string;
  replacements: { id: string; file_name: string; review_status: string }[];
  history: {
    id: string;
    decision: string;
    reason: string;
    actor_user_id: string;
    actor_organization_id: string;
    source_hash: string;
    created_at: string;
  }[];
};
function validEvidenceSummary(value: { id: string; file_name: string; review_status: string }) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.file_name === 'string' &&
    typeof value.review_status === 'string'
  );
}
function validEvidence(value: ReviewEvidence) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.file_name === 'string' &&
    typeof value.review_status === 'string' &&
    typeof value.sha256_hash === 'string'
  );
}
export const evidenceReview = {
  page: async (parameters: Record<string, string>): Promise<CatalogPage<ReviewEvidence>> => {
    const value = await api<CatalogPage<ReviewEvidence>>(
      'GET',
      `/evidence/review/page?${new URLSearchParams(parameters)}`,
    );
    if (
      !value ||
      !Array.isArray(value.items) ||
      !value.items.every(validEvidence) ||
      !(value.nextCursor === null || typeof value.nextCursor === 'string')
    )
      throw new Error('Invalid document review page.');
    return { ...value, hasMore: value.nextCursor !== null };
  },
  detail: async (id: string): Promise<ReviewDetail> => {
    const value = await api<ReviewDetail>('GET', `/evidence/${encodeURIComponent(id)}/review`);
    if (
      !value ||
      !validEvidence(value.evidence) ||
      typeof value.fingerprint !== 'string' ||
      !Array.isArray(value.replacements) ||
      !value.replacements.every(validEvidenceSummary) ||
      !Array.isArray(value.history) ||
      !value.history.every(
        (row) =>
          typeof row.reason === 'string' &&
          typeof row.decision === 'string' &&
          typeof row.source_hash === 'string',
      )
    )
      throw new Error('Invalid document review history.');
    return value;
  },
  decide: (id: string, decision: string, reason: string, expectedFingerprint: string) =>
    api('POST', `/evidence/${encodeURIComponent(id)}/review`, {
      decision,
      reason,
      expectedFingerprint,
    }),
  replace: (id: string, replacementEvidenceId: string, expectedFingerprint: string) =>
    api('POST', `/evidence/${encodeURIComponent(id)}/replacement`, {
      replacementEvidenceId,
      expectedFingerprint,
    }),
};
