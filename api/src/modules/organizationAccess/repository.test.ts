import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock('../../db', () => db);

import { PostgresOrganizationAccessRepository } from './repository';

const applicationRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  organization_name: 'Serious Materials Ltd',
  organization_type: 'supplier',
  jurisdiction: 'GH',
  legal_registration_number: 'REG-123',
  admin_name: 'Ama Admin',
  admin_email: 'ama@example.com',
  status: 'pending_review',
  verification_expires_at: new Date('2026-10-02T00:00:00Z'),
  email_verified_at: new Date('2026-10-01T01:00:00Z'),
  reviewed_by_user_id: null,
  reviewed_at: null,
  review_reason: null,
  approved_organization_id: null,
  first_admin_invitation_id: null,
  created_at: new Date('2026-10-01T00:00:00Z'),
  updated_at: new Date('2026-10-01T01:00:00Z'),
};

describe('Postgres organization access repository', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('approves, creates the organization and invitation, and audits in one transaction', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql.trim());
        if (sql.includes('FROM organization_access_applications') && sql.includes('FOR UPDATE')) return { rows: [applicationRow] };
        if (sql.includes('SELECT 1 FROM organizations')) return { rows: [] };
        if (sql.includes('SELECT id FROM roles')) return { rows: [{ id: 'role-id' }] };
        if (sql.includes('INSERT INTO organizations')) return { rows: [{ id: 'organization-id' }] };
        if (sql.includes('INSERT INTO user_invitations')) return { rows: [{ id: 'invitation-id', expires_at: new Date('2026-10-08T00:00:00Z') }] };
        if (sql.includes('UPDATE organization_access_applications')) return {
          rows: [{ ...applicationRow, status: 'approved', approved_organization_id: 'organization-id', first_admin_invitation_id: 'invitation-id' }],
        };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    db.getClient.mockResolvedValue(client);
    const repository = new PostgresOrganizationAccessRepository();

    const result = await repository.approve({
      id: applicationRow.id,
      actor: { id: 'reviewer-id', organizationId: 'platform-org', permissions: ['*'] },
      reason: 'Pilot organization approved',
      invitationTokenHash: 'a'.repeat(64),
      invitationExpiresAt: new Date('2026-10-08T00:00:00Z'),
    });

    expect(queries[0]).toBe('BEGIN');
    expect(queries[queries.length - 1]).toBe('COMMIT');
    expect(queries.some((sql) => sql.includes('INSERT INTO organizations'))).toBe(true);
    expect(queries.some((sql) => sql.includes('INSERT INTO user_invitations'))).toBe(true);
    expect(queries.some((sql) => sql.includes('INSERT INTO audit_events'))).toBe(true);
    expect(result).toMatchObject({ organizationId: 'organization-id', invitationId: 'invitation-id' });
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back without creating an organization when approval prerequisites fail', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM organization_access_applications') && sql.includes('FOR UPDATE')) {
          return { rows: [{ ...applicationRow, status: 'pending_email_verification', email_verified_at: null }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    db.getClient.mockResolvedValue(client);
    const repository = new PostgresOrganizationAccessRepository();

    await expect(repository.approve({
      id: applicationRow.id,
      actor: { id: 'reviewer-id', organizationId: 'platform-org', permissions: ['*'] },
      invitationTokenHash: 'a'.repeat(64),
      invitationExpiresAt: new Date(),
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO organizations'))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
