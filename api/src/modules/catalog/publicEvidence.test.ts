import { describe, expect, it, vi } from 'vitest';
import { publicEvidencePage } from './publicEvidence';
const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  batch_id: '22222222-2222-2222-2222-222222222222',
};
const item = '33333333-3333-3333-3333-333333333333';
function executor(rows: Record<string, unknown>[] = []) {
  return vi
    .fn()
    .mockResolvedValueOnce({ rows: [profile] })
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ count: 1005 }] });
}
describe('public reviewed evidence boundary', () => {
  it('limits public metadata after current approval and returns full totals independent of search', async () => {
    const execute = executor([{ id: item }]);
    const page = await publicEvidencePage(execute, 'published', { limit: '2', search: '%_' });
    expect(page.count).toBe(1005);
    expect(page.items).toHaveLength(1);
    const [sql, args] = execute.mock.calls[1];
    expect(args).toEqual([profile.batch_id, null, '%_', '%\\%\\_%', 3]);
    expect(sql).toContain('WITH candidates AS MATERIALIZED');
    expect(sql).toContain('LIMIT $5::int');
    expect(execute.mock.calls[0][0]).toContain("visibility='published'");
  });
  it('refuses an embedded read if the profile association changed since the base read', async () => {
    const execute = executor();
    await expect(
      publicEvidencePage(execute, 'published', {}, { id: profile.id, batchId: item }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('rejects absent and unpublished profiles before evidence SQL', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(publicEvidencePage(execute, 'private')).rejects.toMatchObject({ statusCode: 404 });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it.each([{ limit: '101' }, { search: 'x'.repeat(81) }, { all: 'true' }, { cursor: 'invalid' }])(
    'rejects invalid parameters %j',
    async (parameters) => {
      const execute = executor();
      await expect(publicEvidencePage(execute, 'published', parameters)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
  it('binds cursors to the published profile and exact search', async () => {
    const first = await publicEvidencePage(
      executor([{ id: item }, { id: profile.id }]),
      'published',
      { limit: '1' },
    );
    const changed = vi.fn().mockResolvedValueOnce({ rows: [{ ...profile, id: item }] });
    await expect(
      publicEvidencePage(changed, 'another', { limit: '1', cursor: first.nextCursor! }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(changed).toHaveBeenCalledTimes(1);
    const same = executor();
    await expect(
      publicEvidencePage(same, 'published', { cursor: first.nextCursor!, search: 'changed' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('requires validated clean bytes and the latest independent review without exposing storage or uploader fields', async () => {
    const execute = executor();
    await publicEvidencePage(execute, 'published');
    const sql = execute.mock.calls[1][0];
    expect(sql).toContain("validation_status='validated'");
    expect(sql).toContain("malware_scan_status='clean'");
    expect(sql).toContain('ORDER BY tr.reviewed_at DESC');
    expect(sql).toContain("current_review.status='reviewed'");
    expect(sql).toContain('current_review.reviewer_organization_id<>e.uploader_organization_id');
    const projection = sql.slice(sql.indexOf('SELECT e.id,e.type'));
    expect(projection).not.toContain('storage');
    expect(projection).not.toContain('uploader');
  });
});
