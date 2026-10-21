import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
const deps = vi.hoisted(() => ({ assurance: vi.fn(), lifecycle: vi.fn() }));
vi.mock('../mfa/assurance', () => ({ assertMutationAssurance: deps.assurance }));
vi.mock('../mfa/reviewers', () => ({ lockAccessDecisions: deps.lifecycle }));
import { lockInvitationAuthority, lockInvitationTarget } from './authority';
const actor = { id: 'user', organizationId: 'org', sessionId: 'session', permissions: ['*'] };
const query = vi.fn();
const client = { query } as unknown as PoolClient;
beforeEach(() => {
  vi.resetAllMocks();
});
describe('live invitation write authority', () => {
  it.each([['member.invite'], ['*']])(
    'uses current rights %s rather than captured rights',
    async (permission) => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 'session' }] })
        .mockResolvedValueOnce({ rows: [{ permissions: [permission] }] });
      expect(await lockInvitationAuthority(client, { ...actor, permissions: [] })).toEqual({
        isPlatformAdmin: permission === '*',
      });
      expect(deps.lifecycle).toHaveBeenCalledWith(client);
      expect(deps.lifecycle.mock.invocationCallOrder[0]).toBeLessThan(
        deps.assurance.mock.invocationCallOrder[0],
      );
      expect(deps.assurance).toHaveBeenCalledWith(
        client,
        expect.objectContaining({ sessionId: 'session' }),
      );
      expect(query.mock.calls[0][0]).toContain('revoked_at IS NULL AND expires_at>NOW() FOR SHARE');
      expect(query.mock.calls[1][0]).toContain('FOR SHARE OF ur,r');
    },
  );
  it.each([
    { permissions: [] },
    { permissions: ['member.manage'] },
    { permissions: ['offer.create'] },
  ])('rejects removed invitation rights %j despite stale wildcard', async ({ permissions }) => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'session' }] })
      .mockResolvedValueOnce({ rows: [{ permissions }] });
    await expect(lockInvitationAuthority(client, actor)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it('does not retain stale platform scope after demotion to tenant invitation rights', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'session' }] })
      .mockResolvedValueOnce({ rows: [{ permissions: ['member.invite'] }] });
    expect(await lockInvitationAuthority(client, actor)).toEqual({ isPlatformAdmin: false });
  });
  it('rejects revoked or expired sessions even for an ordinary actor without enrolled keys', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ permissions: ['member.invite'] }] });
    await expect(lockInvitationAuthority(client, actor)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('rejects missing sessions and fails closed when assurance changes', async () => {
    await expect(
      lockInvitationAuthority(client, { ...actor, sessionId: undefined }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(query).not.toHaveBeenCalled();
    deps.assurance.mockRejectedValueOnce(new Error('account suspended or fresh assurance lost'));
    await expect(lockInvitationAuthority(client, actor)).rejects.toThrow('account suspended');
    expect(query).not.toHaveBeenCalled();
  });
  it('does not turn a database error into authorization', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(lockInvitationAuthority(client, actor)).rejects.toThrow('database unavailable');
  });
});
describe('target workspace lifecycle and nondisclosure', () => {
  it('locks the verified target before allowing invitation mutation', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ organization_id: 'target' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'target' }] });
    expect(await lockInvitationTarget(client, 'invite', 'org', false)).toBe(true);
    expect(query.mock.calls[0][1]).toEqual(['invite', false, 'org']);
    expect(query.mock.calls[1][1]).toEqual(['target']);
    expect(query.mock.calls[1][0]).toContain("verification_status='verified' FOR SHARE");
  });
  it('treats foreign and absent invitations identically without loading their organization', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await lockInvitationTarget(client, 'foreign', 'org', false)).toBe(false);
    expect(await lockInvitationTarget(client, 'absent', 'org', false)).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('refuses suspended or unverified targets including for live platform administrators', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ organization_id: 'target' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await lockInvitationTarget(client, 'invite', 'org', true)).toBe(false);
  });
});
