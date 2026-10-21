import { beforeEach, describe, expect, it, vi } from 'vitest';
const deps = vi.hoisted(() => ({
  account: vi.fn(),
  compare: vi.fn(),
  create: vi.fn(),
  authenticate: vi.fn(),
  record: vi.fn(),
}));
vi.mock('bcryptjs', () => ({ default: { hash: async () => 'dummy-hash', compare: deps.compare } }));
vi.mock('./loginRepository', () => ({ findLoginAccount: deps.account }));
vi.mock('../../services/authSessionService', () => ({
  createSession: deps.create,
  authenticateSession: deps.authenticate,
}));
vi.mock('../../services/securityEventService', () => ({
  recordSecurityEvent: deps.record,
  securityIdentifierHash: () => 'email-hash',
}));
import { issuePasswordSession } from './login';
const account = {
  id: 'user',
  organization_id: 'org',
  password_hash: 'recorded-hash',
  active: true,
  access_suspended_at: null,
  org_suspended: null,
  verification_status: 'verified',
};
beforeEach(() => {
  vi.resetAllMocks();
  deps.compare.mockResolvedValue(true);
  deps.account.mockResolvedValue(account);
});
describe('password session use case', () => {
  it('keeps the dummy comparison and generic denial for unknown accounts', async () => {
    deps.account.mockResolvedValue(undefined);
    expect(await issuePasswordSession('unknown', 'secret')).toEqual({
      kind: 'denied',
      status: 401,
      error: 'Invalid credentials',
    });
    expect(deps.compare).toHaveBeenCalledWith('secret', 'dummy-hash');
    expect(deps.create).not.toHaveBeenCalled();
    expect(JSON.stringify(deps.record.mock.calls)).not.toContain('secret');
  });
  it('denies suspended identities and unapproved organizations without issuing sessions', async () => {
    deps.account.mockResolvedValue({ ...account, access_suspended_at: new Date() });
    expect(await issuePasswordSession('email', 'secret')).toMatchObject({
      kind: 'denied',
      status: 401,
    });
    deps.account.mockResolvedValue({ ...account, verification_status: 'pending' });
    expect(await issuePasswordSession('email', 'secret')).toMatchObject({
      kind: 'denied',
      status: 403,
      code: 'ORGANIZATION_NOT_ACTIVE',
    });
    expect(deps.create).not.toHaveBeenCalled();
  });
  it('rechecks the newly issued session before exposing it', async () => {
    deps.create.mockResolvedValue({ token: 'new-token' });
    deps.authenticate.mockResolvedValue(null);
    expect(await issuePasswordSession('email', 'secret')).toMatchObject({
      kind: 'denied',
      status: 401,
    });
    expect(deps.create).toHaveBeenCalledWith('user', 'recorded-hash');
    expect(deps.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login.succeeded' }),
    );
  });
  it('returns the live actor and records success after authentication', async () => {
    const actor = { id: 'user', organizationId: 'org', sessionId: 'session' };
    deps.create.mockResolvedValue({ token: 'new-token' });
    deps.authenticate.mockResolvedValue(actor);
    expect(await issuePasswordSession('email', 'secret')).toEqual({
      kind: 'authenticated',
      token: 'new-token',
      actor,
    });
    expect(deps.record).toHaveBeenCalledWith({
      eventType: 'login.succeeded',
      success: true,
      actorUserId: 'user',
      actorOrganizationId: 'org',
      sessionId: 'session',
    });
  });
});
