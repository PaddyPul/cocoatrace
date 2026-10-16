import { api } from './http';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  active: boolean;
  accessSuspended: boolean;
  roles: string[];
  role: string | null;
  legacy: boolean;
  manageable: boolean;
}
export interface TeamRole {
  name: string;
  permissions: string[];
}
export interface MemberPage {
  rows: TeamMember[];
  next: string | null;
}
interface MemberChangeResult {
  id: string;
  changed: boolean;
  revokedSessions: number;
}
export const teamMembers = {
  page: async (search: string, cursor?: string): Promise<MemberPage> => {
    const result = await api<MemberPage>(
      'GET',
      `/team/members/page?${new URLSearchParams({ limit: '20', search, ...(cursor ? { cursor } : {}) })}`,
    );
    if (
      !result ||
      !Array.isArray(result.rows) ||
      result.rows.length > 20 ||
      !(result.next === null || typeof result.next === 'string') ||
      result.rows.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          typeof row.email !== 'string' ||
          typeof row.name !== 'string' ||
          typeof row.active !== 'boolean' ||
          typeof row.accessSuspended !== 'boolean' ||
          typeof row.manageable !== 'boolean' ||
          typeof row.legacy !== 'boolean' ||
          !Array.isArray(row.roles) ||
          row.roles.some((role) => typeof role !== 'string') ||
          !(row.role === null || typeof row.role === 'string'),
      )
    )
      throw new Error('Member page unavailable: invalid response.');
    return result;
  },
  roles: async (): Promise<TeamRole[]> => {
    const result = await api<{ rows: TeamRole[] }>('GET', '/team/roles');
    if (
      !result ||
      !Array.isArray(result.rows) ||
      result.rows.some(
        (role) =>
          !role ||
          typeof role.name !== 'string' ||
          !Array.isArray(role.permissions) ||
          role.permissions.some((value) => typeof value !== 'string'),
      )
    )
      throw new Error('Assignable roles unavailable.');
    return result.rows;
  },
  changeRole: (id: string, data: { role: string; reason: string; currentPassword: string }) =>
    api<MemberChangeResult>('PATCH', `/team/members/${encodeURIComponent(id)}/role`, data),
  deactivate: (id: string, data: { reason: string; currentPassword: string }) =>
    api<MemberChangeResult>('POST', `/team/members/${encodeURIComponent(id)}/deactivate`, data),
};
