import { api } from './http';
import type { CatalogPage } from './http';
import { API_BASE } from './http';

export const audit = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').AuditEvent> & { count: number; latestAt: string | null }>(
      'GET',
      `/audit/events/page?${new URLSearchParams(parameters)}`,
    ),
  summary: (parameters: Record<string, string> = {}) =>
    api<{ count: number; latestAt: string | null }>(
      'GET',
      `/audit/events/summary?${new URLSearchParams(parameters)}`,
    ),
  list: () => api<import('../types').AuditEvent[]>('GET', '/audit/events'),
  export: (parameters: { entityType?: string; entityId?: string } = {}) =>
    `${API_BASE}/audit/export${parameters.entityType && parameters.entityId ? `?${new URLSearchParams({ entityType: parameters.entityType, entityId: parameters.entityId })}` : ''}`,
};
