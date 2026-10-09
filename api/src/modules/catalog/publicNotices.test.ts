import { describe, expect, it, vi } from 'vitest';
import { publicNoticesPage } from './publicNotices';
const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  batch_id: '22222222-2222-2222-2222-222222222222',
};
const id = '33333333-3333-3333-3333-333333333333',
  next = '44444444-4444-4444-4444-444444444444';
function executor(rows: Record<string, unknown>[] = []) {
  return vi
    .fn()
    .mockResolvedValueOnce({ rows: [profile] })
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({
      rows: [
        {
          count: 1005,
          active_count: 1004,
          resolved_count: 1,
          critical_count: 1,
          warning_count: 0,
          advisory_count: 1003,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [{ held: true }] });
}
describe('public notice pages and independent safety', () => {
  it('limits source IDs before hydration and includes both batch and lot associations without duplicate joins', async () => {
    const execute = executor([
      { id, status: 'resolved' },
      { id: next, status: 'active' },
    ]);
    const result = await publicNoticesPage(execute, 'public', {
      limit: '1',
      search: '%_',
      status: 'resolved',
    });
    expect(result.items).toHaveLength(1);
    expect(result.count).toBe(1005);
    expect(result.hasMore).toBe(true);
    expect(result.safety).toMatchObject({
      status: 'critical',
      activeCount: 1004,
      inventoryHeld: true,
    });
    const [sql, args] = execute.mock.calls[1];
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).toContain('recall_affected_batches');
    expect(sql).toContain('recall_affected_lots');
    expect(sql).toContain('recall_safety_holds');
    expect(sql).toContain('recall_recovery_records');
    expect(sql).toContain('ORDER BY r.id LIMIT $6::int');
    expect(args).toEqual([profile.batch_id, 'resolved', null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[2][1]).toEqual([profile.batch_id]);
    expect(execute.mock.calls[2][0]).not.toContain('$2');
  });
  it('retained hold prevents clear when no active notices remain', async () => {
    const execute = executor();
    execute
      .mockReset()
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            count: 1,
            active_count: 0,
            resolved_count: 1,
            critical_count: 0,
            warning_count: 0,
            advisory_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ held: true }] });
    expect((await publicNoticesPage(execute, 'public')).safety.status).toBe('warning');
  });
  it('rechecks publication and expected association before notice SQL', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(publicNoticesPage(execute, 'private')).rejects.toMatchObject({ statusCode: 404 });
    expect(execute).toHaveBeenCalledTimes(1);
    const changed = executor();
    await expect(
      publicNoticesPage(changed, 'public', {}, { id: profile.id, batchId: next }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it('binds cursor to profile, batch, status and literal search', async () => {
    const first = await publicNoticesPage(executor([{ id }, { id: next }]), 'public', {
      limit: '1',
    });
    for (const parameters of [{ status: 'active' }, { search: 'changed' }])
      await expect(
        publicNoticesPage(executor(), 'public', { cursor: first.nextCursor!, ...parameters }),
      ).rejects.toMatchObject({ statusCode: 400 });
    const other = vi.fn().mockResolvedValue({ rows: [{ ...profile, id: next }] });
    await expect(
      publicNoticesPage(other, 'other', { cursor: first.nextCursor! }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([
    { limit: '101' },
    { status: 'draft' },
    { status: ['active', 'resolved'] },
    { search: 'x'.repeat(81) },
    { all: 'true' },
    { cursor: 'invalid' },
  ])('rejects invalid inputs %j', async (parameters) => {
    const execute = executor();
    await expect(publicNoticesPage(execute, 'public', parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
