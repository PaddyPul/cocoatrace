import { describe, expect, it, vi } from 'vitest';
import { publicJourneyPage } from './publicJourney';
const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  batch_id: '22222222-2222-2222-2222-222222222222',
};
const id = '33333333-3333-3333-3333-333333333333';
const next = '44444444-4444-4444-4444-444444444444';
const row = {
  id,
  source_id: id,
  kind: 'custody',
  occurred_at: '2026-01-01T00:00:00.000Z',
  sort_key: '63902822400000.123',
};
function executor(rows: Record<string, unknown>[] = []) {
  return vi
    .fn()
    .mockResolvedValueOnce({ rows: [profile] })
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ count: 1007 }] })
    .mockResolvedValue({
      rows: [
        {
          id,
          quantity_kg: '4.000',
          from_name: 'Seller',
          to_name: 'Buyer',
          warehouse_location: 'Tema',
        },
      ],
    });
}
describe('public journey boundaries', () => {
  it('filters and orders lightweight source rows before hydrating only the chosen page', async () => {
    const execute = executor([row, { ...row, id: next, source_id: next }]);
    const page = await publicJourneyPage(execute, 'published', { limit: '1', search: '%_' });
    expect(page.count).toBe(1007);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id,
      type: 'custody',
      occurredAt: '2026-01-01T00:00:00.000Z',
      summary: '4 kg · Seller → Buyer',
    });
    const [sql, args] = execute.mock.calls[1];
    expect(sql).toContain('ORDER BY sort_key,id LIMIT $6::int');
    expect(sql).toContain("md5(kind||':'||source_id::text)::uuid");
    expect(sql).toContain("ct.status='accepted'");
    expect(sql).toContain('occurred_at IS NOT NULL');
    expect(args).toEqual([profile.batch_id, null, null, '%_', '%\\%\\_%', 2]);
    expect(execute.mock.calls[3][1]).toEqual([[id]]);
  });
  it('continues same-time events by exact numeric time and stable namespaced ID', async () => {
    const first = await publicJourneyPage(executor([row, { ...row, id: next }]), 'published', {
      limit: '1',
    });
    const execute = executor();
    await publicJourneyPage(execute, 'published', { limit: '1', cursor: first.nextCursor! });
    expect(execute.mock.calls[1][1]).toEqual([profile.batch_id, row.sort_key, id, '', '%%', 2]);
  });
  it('rejects unpublished or replaced profile associations before timeline SQL', async () => {
    const missing = vi.fn().mockResolvedValue({ rows: [] });
    await expect(publicJourneyPage(missing, 'private')).rejects.toMatchObject({ statusCode: 404 });
    expect(missing).toHaveBeenCalledTimes(1);
    const changed = executor();
    await expect(
      publicJourneyPage(changed, 'published', {}, { id: profile.id, batchId: next }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it.each([
    { limit: '101' },
    { search: 'x'.repeat(81) },
    { sort: 'id' },
    { all: 'true' },
    { cursor: 'invalid' },
  ])('rejects invalid input %j', async (parameters) => {
    const execute = executor();
    await expect(publicJourneyPage(execute, 'published', parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('binds a time cursor to profile and search', async () => {
    const first = await publicJourneyPage(executor([row, { ...row, id: next }]), 'published', {
      limit: '1',
    });
    const other = vi.fn().mockResolvedValue({ rows: [{ ...profile, id: next }] });
    await expect(
      publicJourneyPage(other, 'other', { cursor: first.nextCursor! }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(other).toHaveBeenCalledTimes(1);
    const changed = executor();
    await expect(
      publicJourneyPage(changed, 'published', { cursor: first.nextCursor!, search: 'different' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
