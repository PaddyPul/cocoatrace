import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { decideAccess } from './service';
import { query } from '../../db';
import { changeAccess } from './repository';
import { recordSecurityEvent } from '../../services/securityEventService';
import bcrypt from 'bcryptjs';
vi.mock('../../db', () => ({ query: vi.fn() }));
vi.mock('./repository', () => ({ changeAccess: vi.fn() }));
vi.mock('../../services/securityEventService', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn() } }));
const actor = {
  id: 'actor',
  organizationId: 'platform',
  sessionId: 'session',
  permissions: ['*'],
} as AuthenticatedActor;
const input = {
  suspended: true,
  reason: 'Reviewed security concern',
  currentPassword: 'never-record-this-password',
};
beforeEach(() => {
  vi.resetAllMocks();
});
describe('password-confirmed access decisions', () => {
  it('denies a tenant administrator before querying or mutating targets', async () => {
    await expect(
      decideAccess({ ...actor, permissions: ['organization.admin'] }, 'users', 'target', input),
    ).rejects.toThrow('Platform administrator');
    expect(query).not.toHaveBeenCalled();
    expect(changeAccess).not.toHaveBeenCalled();
  });
  it('audits failed password confirmation without storing the password or changing access', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ password_hash: 'hash' }] } as Awaited<
      ReturnType<typeof query>
    >);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(decideAccess(actor, 'users', 'target', input)).rejects.toMatchObject({
      code: 'REAUTHENTICATION_REQUIRED',
    });
    expect(changeAccess).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(recordSecurityEvent).mock.calls)).not.toContain(
      input.currentPassword,
    );
  });
  it('passes only the verified hash to the transactional authorization recheck', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ password_hash: 'hash' }] } as Awaited<
      ReturnType<typeof query>
    >);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(changeAccess).mockResolvedValue({
      id: 'target',
      suspended: true,
      changed: true,
      revokedSessions: 2,
    });
    expect((await decideAccess(actor, 'users', 'target', input)).revokedSessions).toBe(2);
    expect(changeAccess).toHaveBeenCalledWith(actor, 'users', 'target', true, input.reason, 'hash');
  });
});
