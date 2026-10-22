import { api } from './http';
import type { CatalogPage } from './http';
import { API_BASE, getToken } from './http';

export interface EvidenceRecordOption {
  id: string;
  label: string;
}

export const evidence = {
  summary: (parameters: Record<string, string> = {}) =>
    api<{ count: number }>('GET', `/evidence/summary?${new URLSearchParams(parameters)}`),
  recordOptions: (parameters: Record<string, string>) =>
    api<CatalogPage<EvidenceRecordOption>>(
      'GET',
      `/evidence/record-options?${new URLSearchParams(parameters)}`,
    ),
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').Evidence>>(
      'GET',
      `/evidence/page?${new URLSearchParams(parameters)}`,
    ),
  list: (entityType?: string, entityId?: string) => {
    const qs =
      entityType && entityId
        ? `?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
        : '';
    return api<import('../types').Evidence[]>('GET', `/evidence${qs}`);
  },
  upload: (
    file: File,
    data: {
      type?: string;
      linkedEntityType: string;
      linkedEntityId: string;
      claimDescription?: string;
      documentExpiresAt?: string;
    },
  ) => {
    return api<{ uploadUrl: string }>('POST', '/evidence/upload-intents', {
      type: data.type || 'other',
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      linkedEntityType: data.linkedEntityType,
      linkedEntityId: data.linkedEntityId,
      claimDescription: data.claimDescription,
      documentExpiresAt: data.documentExpiresAt,
    }).then(async ({ uploadUrl }) => {
      const res = await fetch(API_BASE + uploadUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || `Upload failed (${res.status})`);
      return result;
    });
  },
  download: async (id: string, fileName: string) => {
    const link = await api<{ downloadUrl: string; expiresAt: string }>(
      'POST',
      `/evidence/${id}/download-links`,
      {},
    );
    if (
      typeof link.downloadUrl !== 'string' ||
      !link.downloadUrl.startsWith(`/evidence/${id}/download?`)
    )
      throw new Error('Invalid private download response');
    const res = await fetch(`${API_BASE}${link.downloadUrl}`, {
      credentials: 'include',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(
        typeof detail?.error === 'string' ? detail.error : 'Could not download document',
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
