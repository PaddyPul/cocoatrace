import { describe, expect, it, vi } from 'vitest';
import { invitationPage, invitationSummary, legacyInvitations } from './invitationRecords';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222',
  next = '33333333-3333-3333-3333-333333333333';
const actor = { organizationId: org, permissions: ['member.invite'] };
const executor = () =>
  vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
    .mockResolvedValue({ rows: [{ count: 1005 }] });
describe('bounded invitation history', () => {
  it('limits candidate IDs before safe hydration and keeps full totals independent of literal search', async () => {
    const execute = executor();
    const page = await invitationPage(execute, actor, {
      limit: '1',
      search: '%_',
      status: 'pending',
    });
    expect(page).toMatchObject({ items: [{ id }], hasMore: true, count: 1005 });
    const [sql, args] = execute.mock.calls[0];
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).not.toContain('token_hash');
    expect(sql).not.toContain('created_by_user_id');
    expect(args).toEqual([false, org, 'pending', null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[1][1]).toEqual([false, org, 'pending']);
  });
  it('only wildcard grants network history and cursor binds tenant, permission, status and search', async () => {
    const page = await invitationPage(executor(), actor, { limit: '1' });
    for (const other of [
      { ...actor, organizationId: next },
      { ...actor, permissions: ['member.invite', 'organization.admin'] },
      { ...actor, permissions: ['*'] },
    ])
      await expect(
        invitationPage(executor(), other, { cursor: page.nextCursor! }),
      ).rejects.toMatchObject({ statusCode: 400 });
    for (const params of [{ status: 'revoked' }, { search: 'new' }])
      await expect(
        invitationPage(executor(), actor, { ...params, cursor: page.nextCursor! }),
      ).rejects.toMatchObject({ statusCode: 400 });
    const execute = executor();
    await invitationPage(execute, { ...actor, permissions: ['*'] });
    expect(execute.mock.calls[0][1][0]).toBe(true);
  });
  it('rejects invalid status and paging before query', async () => {
    for (const params of [{ status: 'invalid' }, { limit: '101' }, { unknown: 'x' }]) {
      const execute = vi.fn();
      await expect(invitationPage(execute, actor, params)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it('counts mutually exclusive lifecycle states with a snapshot expiry boundary', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ count: 4, pending_count: 1, accepted_count: 1, revoked_count: 1, expired_count: 1 }],
    });
    expect(await invitationSummary(execute, actor)).toMatchObject({ count: 4, expired_count: 1 });
    expect(execute.mock.calls[0][0]).toContain(
      "WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.expires_at<=NOW() THEN 'expired'",
    );
  });
  it('rejects legacy overflow before hydrating tokens or misleading truncated history', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyInvitations(execute, actor)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
