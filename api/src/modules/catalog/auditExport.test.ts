import { describe, expect, it, vi } from 'vitest';
import { auditExportFilters, auditExportRead, AUDIT_EXPORT_MAX_BYTES } from './auditExport';
const org = '11111111-1111-1111-1111-111111111111';
const id = '22222222-2222-2222-2222-222222222222';
const actor = { organizationId: org, permissions: ['audit.export'] };
function execute(
  rows: Record<string, unknown>[] = [{ id, actor_organization_id: org }],
  bytes = 100,
) {
  return vi
    .fn()
    .mockResolvedValueOnce({ rows: rows.map(({ id }) => ({ id })) })
    .mockResolvedValueOnce({ rows: [{ bytes: String(bytes) }] })
    .mockResolvedValueOnce({ rows });
}
describe('complete bounded audit export', () => {
  it('keeps exact entity filters and organization predicates through all three bounded reads', async () => {
    const read = execute();
    const report = await auditExportRead(read, actor, {
      entityType: 'harvest_batch',
      entityId: id,
    });
    expect(report.count).toBe(1);
    expect(JSON.parse(report.payload)[0].actor_organization_id).toBe(org);
    expect(read.mock.calls[0][1]).toEqual([false, org, 'harvest_batch', id]);
    expect(read.mock.calls[0][0]).toContain('SELECT id');
    expect(read.mock.calls[0][0]).toContain('LIMIT 1001');
    for (const [sql] of read.mock.calls) {
      expect(sql).toContain('actor_organization_id=$2::uuid');
      expect(sql).toContain('entity_type=$3::text');
      expect(sql).toContain('entity_id=$4::uuid');
    }
  });
  it.each(['audit.export.all', '*'])(
    'network scope requires explicit %s permission',
    async (permission) => {
      const read = execute();
      await auditExportRead(read, { ...actor, permissions: [permission] });
      expect(read.mock.calls[0][1][0]).toBe(true);
    },
  );
  it('does not infer export-network authority from unrelated read permissions', async () => {
    const read = execute();
    await auditExportRead(read, {
      ...actor,
      permissions: ['audit.read.all', 'analytics.read.network'],
    });
    expect(read.mock.calls[0][1][0]).toBe(false);
  });
  it.each([
    { entityType: 'batch' },
    { entityId: id },
    { entityType: ['batch'], entityId: id },
    { entityType: 'batch', entityId: 'bad' },
    { limit: '1000' },
    { entityType: 'a'.repeat(81), entityId: id },
  ])('rejects ambiguous or unsupported filters %j before SQL', async (parameters) => {
    const read = execute();
    expect(() => auditExportFilters(parameters)).toThrow();
    await expect(auditExportRead(read, actor, parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects record overflow before any large metadata read', async () => {
    const read = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    await expect(auditExportRead(read, actor)).rejects.toMatchObject({
      statusCode: 422,
      code: 'AUDIT_EXPORT_LIMIT',
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('rejects byte overflow before records leave PostgreSQL', async () => {
    const read = execute(undefined, AUDIT_EXPORT_MAX_BYTES);
    await expect(auditExportRead(read, actor)).rejects.toMatchObject({
      statusCode: 422,
      code: 'AUDIT_EXPORT_LIMIT',
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('does not download a partial result if snapshot record identities disappear', async () => {
    const changed = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id }] })
      .mockResolvedValueOnce({ rows: [{ bytes: '100' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(auditExportRead(changed, actor)).rejects.toMatchObject({
      code: 'AUDIT_EXPORT_UNAVAILABLE',
    });
  });
  it('returns a complete empty array without a count or hydration scan', async () => {
    const read = vi.fn().mockResolvedValue({ rows: [] });
    expect(await auditExportRead(read, actor)).toMatchObject({ payload: '[]', count: 0, bytes: 2 });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
