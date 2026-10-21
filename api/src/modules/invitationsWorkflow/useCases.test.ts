vi.mock('../invitationDelivery/outbox', () => ({
  enqueueInvitationDelivery: async () => undefined,
  cancelInvitationDelivery: async () => undefined,
}));
vi.mock('./authority', () => ({
  lockInvitationAuthority: (...args: unknown[]) => dependencies.authority(...args),
  lockInvitationTarget: (...args: unknown[]) => dependencies.target(...args),
}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const dependencies = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  hash: vi.fn(),
  issue: vi.fn(),
  deliver: vi.fn(),
  audit: vi.fn(),
  authority: vi.fn(),
  target: vi.fn(),
}));
vi.mock('../../db', () => ({
  query: dependencies.query,
  getClient: async () => ({ query: dependencies.clientQuery, release: dependencies.release }),
}));
vi.mock('../../config/env', () => ({
  config: { environment: 'test', publicWebUrl: 'https://app.example' },
}));
vi.mock('bcryptjs', () => ({ default: { hash: dependencies.hash } }));
vi.mock('../../services/invitationIssuance', () => ({
  createPendingInvitation: dependencies.issue,
}));
vi.mock('../../services/invitationDelivery', () => ({ deliverInvitation: dependencies.deliver }));
vi.mock('../../services/audit', () => ({
  record: dependencies.audit,
  hashObject: () => 'safe-hash',
}));
import { acceptInvitation, createInvitation, resendInvitation, revokeInvitation } from './useCases';
const input = {
  user: { id: 'actor', organizationId: 'org', permissions: ['member.invite'] },
  body: {
    email: 'person@example.com',
    password: 'secret',
    name: 'Person',
    organizationId: 'other',
    role: 'admin',
  },
  params: { id: 'invite', token: 'token' },
  query: {},
};
describe('invitation workflows', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.authority.mockResolvedValue({ isPlatformAdmin: false });
    dependencies.target.mockResolvedValue(true);
  });
  it('keeps tenant and cooperative role selection authoritative for a non-platform actor', async () => {
    dependencies.query
      .mockResolvedValueOnce({ rows: [{ id: 'org', name: 'Coop', type: 'cooperative' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'farmer-role', name: 'farmer' }] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.issue.mockResolvedValue({ id: 'invite', email: input.body.email });
    dependencies.deliver.mockResolvedValue({ status: 'sent' });
    const result = await createInvitation(input.user, input.body);
    expect(dependencies.query.mock.calls[0][1]).toEqual(['org']);
    expect(dependencies.query.mock.calls[1][1]).toEqual(['farmer']);
    expect(dependencies.issue).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org', roleId: 'farmer-role', actorId: 'actor' }),
    );
    expect(result).toMatchObject({
      kind: 'success',
      value: { role: 'farmer', inviteUrl: expect.stringContaining('/accept-invite/') },
    });
  });
  it('does not send when transactional issuance audit fails', async () => {
    dependencies.query
      .mockResolvedValueOnce({ rows: [{ id: 'org', name: 'Coop', type: 'cooperative' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'farmer-role', name: 'farmer' }] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.issue.mockRejectedValue(new Error('audit unavailable'));
    await expect(createInvitation(input.user, input.body)).rejects.toThrow('audit unavailable');
    expect(dependencies.deliver).not.toHaveBeenCalled();
  });
  it('locks organization before invitation and commits acceptance before releasing', async () => {
    dependencies.clientQuery
      .mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: 'org' }] })
      .mockResolvedValueOnce({ rows: [{ access_suspended_at: null }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'invite', organization_id: 'org', email: input.body.email, role_id: 'role' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'user', email: input.body.email, name: 'Person' }] });
    dependencies.hash.mockResolvedValue('password-hash');
    expect(await acceptInvitation(input.params.token, input.body)).toMatchObject({
      kind: 'success',
      value: { id: 'user' },
    });
    const statements = dependencies.clientQuery.mock.calls.map((call) => call[0]);
    expect(statements[2]).toContain('FOR SHARE');
    expect(statements[3]).toContain('FOR UPDATE');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(dependencies.hash).toHaveBeenCalledWith('secret', 12);
    expect(dependencies.release).toHaveBeenCalledOnce();
  });
  it('rolls back invalid acceptance without hashing passwords', async () => {
    dependencies.clientQuery.mockResolvedValue({ rows: [] });
    expect(await acceptInvitation(input.params.token, input.body)).toMatchObject({
      kind: 'invalid_invitation',
    });
    expect(dependencies.clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(dependencies.hash).not.toHaveBeenCalled();
    expect(dependencies.release).toHaveBeenCalledOnce();
  });
  it('maps duplicate users to conflict and releases after rollback', async () => {
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce({ code: '23505' })
      .mockResolvedValue({ rows: [] });
    expect(await acceptInvitation(input.params.token, input.body)).toEqual({
      kind: 'account_exists',
      message: 'An account with this email already exists',
    });
    expect(dependencies.clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(dependencies.release).toHaveBeenCalledOnce();
  });
  it('does not audit a missing revocation', async () => {
    dependencies.clientQuery.mockResolvedValue({ rows: [] });
    expect(await revokeInvitation(input.user, input.params.id)).toMatchObject({
      kind: 'active_invitation_missing',
    });
    expect(dependencies.audit).not.toHaveBeenCalled();
  });
  it('rotates a token and exposes the test link while preserving delivery status', async () => {
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'invite',
            email: input.body.email,
            expires_at: 'future',
            organization_name: 'Coop',
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    dependencies.deliver.mockImplementation(async () => {
      expect(dependencies.clientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(dependencies.release).toHaveBeenCalledOnce();
      return { status: 'failed' };
    });
    expect(await resendInvitation(input.user, input.params.id)).toMatchObject({
      value: { emailDelivery: 'failed', inviteUrl: expect.stringContaining('/accept-invite/') },
    });
    expect(dependencies.clientQuery.mock.calls[1][1]).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'invite',
      false,
      'org',
    ]);
  });
  it.each(['revoke', 'resend', 'accept'])(
    'rolls back %s on audit failure without sending',
    async (operation) => {
      dependencies.clientQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO audit_events')) throw new Error('audit unavailable');
        if (sql.includes('SELECT organization_id')) return { rows: [{ organization_id: 'org' }] };
        if (sql.includes('FOR SHARE')) return { rows: [{ access_suspended_at: null }] };
        if (sql.includes('FOR UPDATE'))
          return {
            rows: [
              { id: 'invite', organization_id: 'org', email: input.body.email, role_id: 'role' },
            ],
          };
        if (sql.includes('INSERT INTO users')) return { rows: [{ id: 'new-user' }] };
        if (sql.includes('UPDATE user_invitations'))
          return { rows: [{ id: 'invite', email: input.body.email }] };
        return { rows: [] };
      });
      dependencies.hash.mockResolvedValue('password-hash');
      const result =
        operation === 'accept'
          ? acceptInvitation('token', input.body)
          : operation === 'revoke'
            ? revokeInvitation(input.user, 'invite')
            : resendInvitation(input.user, 'invite');
      await expect(result).rejects.toThrow('audit unavailable');
      const auditCall = dependencies.clientQuery.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO audit_events'),
      )!;
      expect(auditCall[1][0]).toBe(operation === 'accept' ? 'new-user' : 'actor');
      expect(auditCall[1][6]).toBe('{}');
      expect(dependencies.clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
      expect(dependencies.clientQuery.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
      expect(dependencies.deliver).not.toHaveBeenCalled();
      expect(dependencies.release).toHaveBeenCalledOnce();
    },
  );
});

describe('invitation transaction authority failures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.authority.mockResolvedValue({ isPlatformAdmin: false });
    dependencies.target.mockResolvedValue(true);
  });
  it.each(['resend', 'revoke'])(
    'rolls back %s before token mutation, audit or delivery on live denial',
    async (operation) => {
      dependencies.clientQuery.mockResolvedValue({ rows: [] });
      dependencies.authority.mockRejectedValueOnce(new Error('authorization changed'));
      const action = operation === 'resend' ? resendInvitation : revokeInvitation;
      await expect(action(input.user, 'invite')).rejects.toThrow('authorization changed');
      expect(dependencies.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN',
        'ROLLBACK',
      ]);
      expect(dependencies.deliver).not.toHaveBeenCalled();
      expect(dependencies.release).toHaveBeenCalledOnce();
    },
  );
  it.each(['resend', 'revoke'])(
    'returns nondisclosing missing result for %s when target becomes suspended',
    async (operation) => {
      dependencies.clientQuery.mockResolvedValue({ rows: [] });
      dependencies.target.mockResolvedValueOnce(false);
      const action = operation === 'resend' ? resendInvitation : revokeInvitation;
      expect(await action(input.user, 'invite')).toMatchObject({
        kind: operation === 'resend' ? 'invitation_missing' : 'active_invitation_missing',
      });
      expect(dependencies.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN',
        'ROLLBACK',
      ]);
      expect(dependencies.deliver).not.toHaveBeenCalled();
      expect(dependencies.release).toHaveBeenCalledOnce();
    },
  );
});
