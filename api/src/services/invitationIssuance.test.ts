import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const deps = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  authority: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock('../db', () => ({ getClient: async () => ({ query: deps.query, release: deps.release }) }));
vi.mock('../modules/invitationsWorkflow/authority', () => ({
  lockInvitationAuthority: deps.authority,
}));
vi.mock('../modules/invitationDelivery/outbox', () => ({
  enqueueInvitationDelivery: deps.enqueue,
}));
import { createPendingInvitation } from './invitationIssuance';
const input = {
  organizationId: 'actor-org',
  email: 'person@example.com',
  roleId: 'role',
  token: 'secret-token',
  tokenHash: crypto.createHash('sha256').update('secret-token').digest('hex'),
  actorId: 'actor',
  actorOrganizationId: 'actor-org',
  actorSessionId: 'session',
};
describe('invitation issuance live authority and atomic outbox', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    deps.authority.mockResolvedValue({ isPlatformAdmin: false });
    deps.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT type FROM organizations')) return { rows: [{ type: 'exporter' }] };
      if (sql.includes('SELECT name FROM roles')) return { rows: [{ name: 'exporter' }] };
      if (sql.includes('SELECT organization_id FROM users'))
        return { rows: [{ organization_id: 'actor-org' }] };
      if (sql.includes('INSERT INTO user_invitations')) return { rows: [{ id: 'invitation' }] };
      return { rows: [] };
    });
  });
  it('resolves missing actor organization but still requires live authority', async () => {
    await createPendingInvitation({ ...input, actorOrganizationId: undefined });
    expect(deps.authority).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'actor-org', sessionId: 'session' }),
    );
    expect(deps.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('commits invitation, business audit and outbox before release without logging credentials', async () => {
    await expect(createPendingInvitation(input)).resolves.toEqual({ id: 'invitation' });
    expect(deps.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'actor' }),
      'invitation',
      input.token,
    );
    expect(deps.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      deps.release.mock.invocationCallOrder[0],
    );
    const auditCall = deps.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO audit_events'),
    )!;
    expect(auditCall[1].slice(0, 5)).toEqual([
      'actor',
      'actor-org',
      'member.invite',
      'user_invitation',
      'invitation',
    ]);
    expect(JSON.stringify(auditCall)).not.toContain(input.email);
    expect(JSON.stringify(auditCall)).not.toContain(input.token);
    expect(deps.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('rolls back invitation when outbox persistence fails', async () => {
    deps.enqueue.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(createPendingInvitation(input)).rejects.toThrow('outbox unavailable');
    expect(deps.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(deps.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(deps.release).toHaveBeenCalledOnce();
  });
  it('rejects stale authority before any invitation or outbox write', async () => {
    deps.authority.mockRejectedValueOnce(new Error('authorization changed'));
    await expect(createPendingInvitation(input)).rejects.toThrow('authorization changed');
    expect(deps.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
  it.each([{ organizationId: 'foreign-org' }, { roleId: 'elevated-role' }])(
    'rejects changed organization/role scope %j',
    async (change) => {
      if (change.roleId)
        deps.query.mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT type FROM organizations'))
            return { rows: [{ type: 'exporter' }] };
          if (sql.includes('SELECT name FROM roles')) return { rows: [{ name: 'admin' }] };
          return { rows: [] };
        });
      await expect(createPendingInvitation({ ...input, ...change })).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(deps.enqueue).not.toHaveBeenCalled();
      expect(deps.query).toHaveBeenLastCalledWith('ROLLBACK');
    },
  );
  it('does not enqueue when the mutation audit fails', async () => {
    const normal = deps.query.getMockImplementation()!;
    deps.query.mockImplementation(async (sql, ...args) => {
      if (sql.includes('INSERT INTO audit_events')) throw new Error('audit unavailable');
      return normal(sql, ...args);
    });
    await expect(createPendingInvitation(input)).rejects.toThrow('audit unavailable');
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
