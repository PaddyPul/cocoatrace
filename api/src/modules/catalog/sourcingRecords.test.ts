import { describe, expect, it, vi } from 'vitest';
import { legacySourcing, sourcingPage, sourcingSummary } from './sourcingRecords';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222',
  next = '33333333-3333-3333-3333-333333333333';
const buyer = { organizationId: org, permissions: ['listing.read'] };
describe('bounded sourcing requests', () => {
  it('limits candidate rows before hydration and escapes literal wildcard search', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: next }] });
    const result = await sourcingPage(execute, buyer, { limit: '1', search: '%_', mine: 'true' });
    expect(result).toMatchObject({ items: [{ id }], hasMore: true });
    expect(execute.mock.calls[0][0]).toContain('WITH candidates AS MATERIALIZED');
    expect(execute.mock.calls[0][1]).toEqual([org, false, null, '%_', '%\\%\\_%', 2, null, true]);
  });
  it('binds cursors to tenant, search, permission and own scope', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: next }] });
    const result = await sourcingPage(execute, buyer, { limit: '1' });
    for (const [actor, parameters] of [
      [{ ...buyer, organizationId: next }, {}],
      [buyer, { mine: 'true' }],
      [buyer, { search: 'changed' }],
      [{ ...buyer, permissions: ['listing.read', 'offer.respond'] }, {}],
    ] as const)
      await expect(
        sourcingPage(
          execute,
          { ...actor, permissions: [...actor.permissions] },
          { ...parameters, cursor: result.nextCursor! },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('only seller permissions expose open matched demand', async () => {
    for (const permission of [
      'listing.read',
      'analytics.read.network',
      'listing.create',
      'offer.respond',
      '*',
    ]) {
      const execute = vi.fn().mockResolvedValue({ rows: [] });
      await sourcingPage(execute, { ...buyer, permissions: [permission] });
      expect(execute.mock.calls[0][1][1]).toBe(
        ['listing.create', 'offer.respond', '*'].includes(permission),
      );
    }
  });
  it('rejects malformed filters before querying', async () => {
    for (const parameters of [{ id: 'bad' }, { mine: 'yes' }, { limit: '101' }, { unknown: 'x' }]) {
      const execute = vi.fn();
      await expect(sourcingPage(execute, buyer, parameters)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it('keeps aggregate reads independent of pagination and caps latest records', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ own_count: 1005, open_count: 1004 }] })
      .mockResolvedValue({ rows: [{ id }] });
    expect(await sourcingSummary(execute, buyer)).toEqual({
      own_count: 1005,
      open_count: 1004,
      latest_own: { id },
      latest_own_open: { id },
      latest_open: { id },
    });
    expect(execute.mock.calls.slice(1).every((call) => call[0].includes('LIMIT 1'))).toBe(true);
  });
  it('rejects legacy overflow without hydrating an incomplete list', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacySourcing(execute, buyer)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
