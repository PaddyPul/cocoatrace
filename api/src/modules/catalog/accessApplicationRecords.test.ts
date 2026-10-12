import { describe, expect, it, vi } from 'vitest';
import {
  accessApplicationPage,
  accessApplicationSummary,
  legacyAccessApplications,
} from './accessApplicationRecords';
const id = '11111111-1111-1111-1111-111111111111',
  next = '22222222-2222-2222-2222-222222222222';
const actor = { id, organizationId: id, permissions: ['*'] };
const row = {
  id,
  organization_name: 'Example',
  organization_type: 'supplier',
  jurisdiction: 'GH',
  admin_name: 'Admin',
  admin_email: 'admin@example.test',
  status: 'pending_review',
  verification_token_hash: 'SECRET',
  verification_expires_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};
describe('bounded platform access application reads', () => {
  it('requires exact wildcard authority before reading applicant identities', async () => {
    for (const permissions of [
      [],
      ['organization.admin'],
      ['audit.read.all', 'analytics.read.network'],
    ]) {
      const execute = vi.fn();
      await expect(accessApplicationPage(execute, { ...actor, permissions })).rejects.toMatchObject(
        { statusCode: 403 },
      );
      await expect(
        accessApplicationSummary(execute, { ...actor, permissions }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it('limits candidate IDs before safe DTO hydration and escapes literal search', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ count: 1005 }] });
    const page = await accessApplicationPage(execute, actor, {
      limit: '1',
      status: 'pending_review',
      search: '%_',
    });
    expect(page).toMatchObject({
      items: [{ id, organizationName: 'Example' }],
      count: 1005,
      hasMore: true,
    });
    expect(JSON.stringify(page)).not.toContain('SECRET');
    expect(execute.mock.calls[0][1]).toEqual(['pending_review', null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[1][1]).toEqual([[id]]);
    expect(execute.mock.calls[1][0]).not.toContain('verification_token_hash');
    expect(execute.mock.calls[2][1]).toEqual(['pending_review']);
  });
  it('binds cursors to actor scope, exact permissions, status and search', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] });
    const first = await accessApplicationPage(execute, actor, { limit: '1' });
    for (const [who, parameters] of [
      [actor, { status: 'rejected' }],
      [actor, { search: 'changed' }],
      [{ ...actor, organizationId: next }, {}],
      [{ ...actor, permissions: ['*', 'organization.admin'] }, {}],
    ] as const)
      await expect(
        accessApplicationPage(
          execute,
          { ...who, permissions: [...who.permissions] },
          { ...parameters, cursor: first.nextCursor! },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects malformed inputs before queries', async () => {
    for (const parameters of [
      { limit: '101' },
      { status: 'expired' },
      { search: 'x'.repeat(81) },
      { unexpected: 'yes' },
    ]) {
      const execute = vi.fn();
      await expect(accessApplicationPage(execute, actor, parameters)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it('summarizes all four disjoint stored states independently of current page', async () => {
    const totals = {
      count: 1005,
      pending_email_verification_count: 251,
      pending_review_count: 252,
      approved_count: 251,
      rejected_count: 251,
    };
    const execute = vi.fn().mockResolvedValue({ rows: [totals] });
    expect(await accessApplicationSummary(execute, actor)).toEqual(totals);
    expect(execute.mock.calls[0][0]).not.toContain('LIMIT');
    expect(execute.mock.calls[0][0]).not.toContain('verification_token_hash');
  });
  it('legacy overflow fails before DTO hydration while small results retain safe mapping', async () => {
    const overflow = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyAccessApplications(overflow)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(overflow).toHaveBeenCalledTimes(1);
    const small = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }] })
      .mockResolvedValueOnce({ rows: [row] });
    expect(await legacyAccessApplications(small)).toMatchObject([
      { id, adminEmail: 'admin@example.test' },
    ]);
    expect(
      JSON.stringify(await legacyAccessApplications(vi.fn().mockResolvedValue({ rows: [] }))),
    ).toBe('[]');
  });
});
