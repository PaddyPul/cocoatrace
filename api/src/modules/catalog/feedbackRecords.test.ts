import { describe, expect, it, vi } from 'vitest';
import { feedbackPage, feedbackSummary, legacyFeedback } from './feedbackRecords';
const org = '11111111-1111-1111-1111-111111111111',
  id = '22222222-2222-2222-2222-222222222222',
  next = '33333333-3333-3333-3333-333333333333';
const actor = { organizationId: org, permissions: ['organization.admin'] };
const executor = () =>
  vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ id }, { id: next }] })
    .mockResolvedValue({ rows: [{ count: 1005 }] });
describe('bounded pilot feedback reads', () => {
  it('limits IDs before safe hydration, escapes search and counts rating independently of search', async () => {
    const execute = executor();
    const result = await feedbackPage(execute, actor, { limit: '1', search: '%_', rating: '5' });
    expect(result).toMatchObject({ items: [{ id }], hasMore: true, count: 1005 });
    expect(execute.mock.calls[0][0]).toContain('WITH candidates AS MATERIALIZED');
    expect(execute.mock.calls[0][0]).not.toContain('f.*');
    expect(execute.mock.calls[0][0]).not.toContain('u.email');
    expect(execute.mock.calls[0][1]).toEqual([false, org, 5, null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[1][1]).toEqual([false, org, 5]);
  });
  it('binds cursor to tenant, current permission, rating and search', async () => {
    const page = await feedbackPage(executor(), actor, { limit: '1' });
    for (const who of [
      { ...actor, organizationId: next },
      { ...actor, permissions: ['*'] },
    ])
      await expect(
        feedbackPage(executor(), who, { cursor: page.nextCursor! }),
      ).rejects.toMatchObject({ statusCode: 400 });
    for (const params of [{ rating: '5' }, { search: 'changed' }])
      await expect(
        feedbackPage(executor(), actor, { ...params, cursor: page.nextCursor! }),
      ).rejects.toMatchObject({ statusCode: 400 });
    const execute = executor();
    await feedbackPage(execute, { ...actor, permissions: ['*'] });
    expect(execute.mock.calls[0][1][0]).toBe(true);
  });
  it('rejects invalid filters before executing SQL', async () => {
    for (const params of [
      { rating: '0' },
      { rating: '6' },
      { rating: '1.0' },
      { rating: ['1', '2'] },
      { limit: '101' },
      { offset: '1' },
    ]) {
      const execute = vi.fn();
      await expect(feedbackPage(execute, actor, params)).rejects.toMatchObject({ statusCode: 400 });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it('summary counts every rating without inheriting page filters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005, rating_5_count: 1005 }] });
    await feedbackSummary(execute, actor);
    expect(execute.mock.calls[0][0]).toContain('rating_5_count');
    expect(execute.mock.calls[0][1]).toEqual([false, org]);
    await expect(feedbackSummary(execute, actor, { rating: '5' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it('legacy checks caps before hydration and never truncates', async () => {
    const oversized = vi
      .fn()
      .mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(legacyFeedback(oversized, actor)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(oversized).toHaveBeenCalledTimes(1);
    const small = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }] })
      .mockResolvedValueOnce({ rows: [{ id, rating: 5 }] });
    expect(await legacyFeedback(small, actor)).toEqual([{ id, rating: 5 }]);
    expect(small.mock.calls[1][0]).not.toContain('LIMIT');
    const empty = vi.fn().mockResolvedValue({ rows: [] });
    expect(await legacyFeedback(empty, actor)).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(1);
  });
});
