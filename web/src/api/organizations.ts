import { api } from './http';
import type { CatalogPage } from './http';

export interface OrganizationRecord {
  id: string;
  name: string;
  type: string;
  jurisdiction?: string | null;
  verification_status?: string | null;
}

export interface OrganizationMember {
  id: string;
  email: string;
  name?: string | null;
  roles: string[];
}

export const organizations = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<OrganizationRecord> & { count: number }>(
      'GET',
      `/organizations/page?${new URLSearchParams(parameters)}`,
    ),
  summary: () => api<{ count: number }>('GET', '/organizations/summary'),
  membersPage: (id: string, parameters: Record<string, string>) =>
    api<CatalogPage<OrganizationMember> & { count: number }>(
      'GET',
      `/organizations/${encodeURIComponent(id)}/members/page?${new URLSearchParams(parameters)}`,
    ),
  membersSummary: (id: string) =>
    api<{ count: number }>('GET', `/organizations/${encodeURIComponent(id)}/members/summary`),
  list: () => api<any[]>('GET', '/organizations'),
  get: (id: string) => api<any>('GET', `/organizations/${id}`),
  create: (data: { name: string; type: string; country?: string; verificationStatus?: string }) =>
    api<any>('POST', '/organizations', data),
  members: (id: string) => api<any[]>('GET', `/organizations/${id}/members`),
};
