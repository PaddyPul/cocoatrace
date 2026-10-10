import { describe, expect, it, vi } from 'vitest';
import {
  legacyMembers,
  legacyOrganizations,
  memberPage,
  memberSummary,
  organizationPage,
} from './organizationRecords';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222',
  next = '33333333-3333-3333-3333-333333333333';
const actor = { organizationId: org, permissions: ['organization.admin'] };
describe('bounded organization administration reads', () => {
  it('does not treat tenant administration as network authority and excludes private organization fields', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
      .mockResolvedValue({ rows: [{ count: 1005 }] });
    const page = await organizationPage(execute, actor, { limit: '1', search: '%_' });
    expect(page).toMatchObject({ items: [{ id }], hasMore: true, count: 1005 });
    expect(execute.mock.calls[0][1]).toEqual([org, false, '', null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[0][0]).not.toContain('SELECT *');
    expect(execute.mock.calls[0][0]).not.toContain('legal_registration_number');
  });
  it('only wildcard enables network organization reads', async () => {
    for (const permissions of [
      ['organization.admin'],
      ['organization.admin', 'analytics.read.network'],
      ['*'],
    ]) {
      const execute = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [{ count: 0 }] });
      await organizationPage(execute, { ...actor, permissions });
      expect(execute.mock.calls[0][1][1]).toBe(permissions.includes('*'));
    }
  });
  it('binds cursors to tenant, type, permissions and search', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
      .mockResolvedValue({ rows: [{ count: 2 }] });
    const page = await organizationPage(execute, actor, { limit: '1' });
    for (const [who, parameters] of [
      [actor, { type: 'exporter' }],
      [actor, { search: 'changed' }],
      [{ ...actor, permissions: ['*'] }, {}],
      [{ ...actor, organizationId: next }, {}],
    ] as const)
      await expect(
        organizationPage(
          execute,
          { ...who, permissions: [...who.permissions] },
          { ...parameters, cursor: page.nextCursor! },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects foreign members and malformed organization IDs before reading', async () => {
    const execute = vi.fn();
    await expect(memberPage(execute, actor, next)).rejects.toMatchObject({ statusCode: 403 });
    await expect(memberSummary(execute, actor, 'bad')).rejects.toMatchObject({ statusCode: 400 });
    expect(execute).not.toHaveBeenCalled();
  });
  it('limits member IDs before role hydration and excludes password/security material', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
      .mockResolvedValueOnce({ rows: [{ count: 1005 }] })
      .mockResolvedValueOnce({ rows: [{ id, roles: [] }] });
    const result = await memberPage(execute, actor, org, { limit: '1' });
    expect(result).toMatchObject({ items: [{ id, roles: [] }], count: 1005, hasMore: true });
    expect(execute.mock.calls[0][0]).toContain('LIMIT $5::int');
    expect(execute.mock.calls[2][1]).toEqual([org, [id]]);
    expect(execute.mock.calls[2][0]).toContain('ARRAY[]::text[]');
    expect(execute.mock.calls[2][0]).not.toContain('password_hash');
  });
  it('fails both legacy overflows before hydrating records or roles', async () => {
    for (const members of [false, true]) {
      const execute = vi
        .fn()
        .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
      await expect(
        members ? legacyMembers(execute, actor, org) : legacyOrganizations(execute, actor),
      ).rejects.toMatchObject({ statusCode: 422, code: 'CATALOG_READ_LIMIT' });
      expect(execute).toHaveBeenCalledTimes(1);
    }
  });
});
