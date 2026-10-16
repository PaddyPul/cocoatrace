import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { definitions } from './policy';
import { changeMember, listRoles } from './repository';
import { recordAudit } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';
const mocks = vi.hoisted(() => ({ query: vi.fn(), compare: vi.fn() }));
vi.mock('../../services/databaseTransaction', () => ({
  inDatabaseTransaction: async (work: (client: unknown) => unknown) => work({ query: mocks.query }),
}));
vi.mock('../../services/auditWriter', () => ({ recordAudit: vi.fn() }));
vi.mock('../mfa/reviewers', () => ({ lockAccessDecisions: vi.fn() }));
vi.mock('../mfa/assurance', () => ({ assertMutationAssurance: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }));
const actor = { id: 'actor', organizationId: 'org', sessionId: 'session' } as AuthenticatedActor;
const input = {
  reason: 'Reviewed membership decision',
  currentPassword: 'secret',
  role: 'buyer_viewer',
};
const defs = definitions('importer');
const roles = Object.entries(defs).map(([name, permissions]) => ({ id: name, name, permissions }));
type FixtureUser = { id: string; active: boolean; password_hash?: string; roles: typeof roles };
let users: FixtureUser[], session: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  session = true;
  mocks.compare.mockResolvedValue(true);
  users = [
    { id: 'actor', active: true, password_hash: 'live hash', roles: [roles[0]] },
    { id: 'target', active: true, roles: [roles[1]] },
  ];
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM organizations'))
      return { rows: [{ id: 'org', type: 'importer', verification_status: 'verified' }] };
    if (sql.startsWith('SELECT id,name,permissions FROM roles')) return { rows: roles };
    if (sql.startsWith('SELECT u.*')) return { rows: users };
    if (sql.startsWith('SELECT id FROM sessions'))
      return { rows: session ? [{ id: 'session' }] : [] };
    return { rows: [], rowCount: 2 };
  });
});
describe('team mutation live authorization and invalidation', () => {
  it('rechecks session and the actual role permissions', async () => {
    session = false;
    await expect(changeMember(actor, 'target', input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    session = true;
    users[0].roles = [{ ...roles[0], permissions: [...roles[0].permissions, '*'] }];
    await expect(changeMember(actor, 'target', input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it('rejects foreign, self and custom target identities before mutation', async () => {
    await expect(changeMember(actor, 'foreign', input)).rejects.toMatchObject({ statusCode: 404 });
    await expect(changeMember(actor, 'actor', input)).rejects.toMatchObject({
      code: 'SELF_CHANGE_FORBIDDEN',
    });
    users[1].roles = [{ ...roles[1], name: 'custom' }];
    await expect(changeMember(actor, 'target', input)).rejects.toMatchObject({
      code: 'PROTECTED_MEMBER',
    });
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it('uses live password and assurance and revokes every ephemeral credential in the transaction', async () => {
    const result = await changeMember(actor, 'target', input);
    expect(result).toEqual({ id: 'target', changed: true, revokedSessions: 2 });
    expect(mocks.compare).toHaveBeenCalledWith('secret', 'live hash');
    expect(assertMutationAssurance).toHaveBeenCalled();
    for (const table of ['sessions', 'password_reset_tokens', 'mfa_challenges', 'user_invitations'])
      expect(
        mocks.query.mock.calls.some(([sql]) => sql.includes(table) && !sql.startsWith('SELECT')),
      ).toBe(true);
    expect(
      mocks.query.mock.calls.some(([sql]) => sql.includes('mfa_recovery_approved_until=NULL')),
    ).toBe(true);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      'team.member.role_changed',
      'user',
      'target',
      expect.objectContaining({ role: 'buyer_viewer' }),
    );
  });
  it('does not mutate on invalid password or role and propagates audit failures', async () => {
    mocks.compare.mockResolvedValueOnce(false);
    await expect(changeMember(actor, 'target', input)).rejects.toMatchObject({
      code: 'REAUTHENTICATION_REQUIRED',
    });
    await expect(changeMember(actor, 'target', { ...input, role: 'admin' })).rejects.toMatchObject({
      code: 'ROLE_NOT_ASSIGNABLE',
    });
    vi.mocked(recordAudit).mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(changeMember(actor, 'target', input)).rejects.toThrow('audit unavailable');
  });
  it('exposes only canonical roles bounded by the live actor permissions', async () => {
    expect((await listRoles(actor)).rows.map((r) => r.name)).toEqual(roles.map((r) => r.name));
  });
});
