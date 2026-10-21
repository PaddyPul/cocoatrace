import { beforeEach, describe, expect, it, vi } from 'vitest';
const deps = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), assurance: vi.fn() }));
vi.mock('../db', () => ({ getClient: async () => ({ query: deps.query, release: deps.release }) }));
vi.mock('../modules/mfa/assurance', () => ({ assertMutationAssurance: deps.assurance }));
import { createPendingInvitation } from './invitationIssuance';
const input = {
  organizationId: 'target-org',
  email: 'person@example.com',
  roleId: 'role',
  tokenHash: 'secret-token-hash',
  actorId: 'actor',
  actorOrganizationId: 'actor-org',
  actorSessionId: 'session',
};
describe('invitation issuance atomic audit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('resolves the actor organization for existing noninteractive callers', async () => {
    deps.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO user_invitations')) return { rows: [{ id: 'invitation' }] };
      if (sql.includes('SELECT organization_id FROM users'))
        return { rows: [{ organization_id: 'actor-org' }] };
      return { rows: [] };
    });
    await createPendingInvitation({ ...input, actorOrganizationId: undefined });
    expect(deps.assurance).not.toHaveBeenCalled();
    const auditCall = deps.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO audit_events'),
    )!;
    expect(auditCall[1].slice(0, 2)).toEqual(['actor', 'actor-org']);
    expect(deps.query).toHaveBeenLastCalledWith('COMMIT');
  });
  it.each([false, true])(
    'commits issuance and audit together; audit failure=%s',
    async (failAudit) => {
      deps.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO audit_events') && failAudit)
          throw new Error('audit unavailable');
        if (sql.includes('INSERT INTO user_invitations')) return { rows: [{ id: 'invitation' }] };
        return { rows: [] };
      });
      const result = createPendingInvitation(input);
      if (failAudit) await expect(result).rejects.toThrow('audit unavailable');
      else await expect(result).resolves.toEqual({ id: 'invitation' });
      const statements = deps.query.mock.calls.map(([sql]) => sql);
      const auditIndex = statements.findIndex((sql) => sql.includes('INSERT INTO audit_events'));
      expect(statements.findIndex((sql) => sql.includes('pg_advisory_xact_lock'))).toBeLessThan(
        auditIndex,
      );
      expect(deps.assurance).toHaveBeenCalledWith(expect.anything(), {
        id: 'actor',
        organizationId: 'actor-org',
        sessionId: 'session',
      });
      const auditValues = deps.query.mock.calls[auditIndex][1];
      expect(auditValues.slice(0, 5)).toEqual([
        'actor',
        'actor-org',
        'member.invite',
        'user_invitation',
        'invitation',
      ]);
      expect(JSON.stringify(auditValues)).not.toContain(input.email);
      expect(JSON.stringify(auditValues)).not.toContain(input.tokenHash);
      expect(deps.query).toHaveBeenLastCalledWith(failAudit ? 'ROLLBACK' : 'COMMIT');
      if (failAudit) expect(statements).not.toContain('COMMIT');
      expect(deps.release).toHaveBeenCalledOnce();
    },
  );
});
