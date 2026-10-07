import { describe, expect, it, vi } from 'vitest';
import { evidencePage, legacyEvidenceList } from './evidenceRecords';
const actor = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: ['evidence.read'],
};
const id = '22222222-2222-2222-2222-222222222222';
describe('bounded evidence metadata reads', () => {
  it('types every page parameter and limits only after tenant and literal search filters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await evidencePage(execute, actor, { limit: '2', search: '%_' });
    const [sql, parameters] = execute.mock.calls[0];
    for (let i = 1; i <= 8; i++) expect(sql).toContain(`$${i}::`);
    expect(sql).toContain('uploader_organization_id=$1::uuid');
    expect(parameters).toEqual([actor.organizationId, false, '', null, null, '%_', '%\\%\\_%', 3]);
    expect(sql).not.toContain('storage_key');
    expect(sql).not.toContain('storage_path');
    expect(sql).not.toContain('SELECT *');
  });
  it.each(['farm', 'batch', 'certificate', 'contract', 'shipment', 'recall', 'product_profile'])(
    'uses the same bounded executor for %s relationship authorization and metadata',
    async (entityType) => {
      const execute = vi.fn().mockImplementation(async (sql: string, _parameters?: unknown[]) => ({
        rows: sql.includes('SELECT EXISTS')
          ? [{ allowed: true }]
          : sql.includes('SELECT batch_id')
            ? [{ batch_id: id }]
            : [],
      }));
      await evidencePage(execute, actor, { entityType, entityId: id });
      expect(execute.mock.calls.at(-1)?.[0]).toContain('FROM evidence_items');
      expect(execute.mock.calls.at(-1)?.[1]?.slice(2, 4)).toEqual([entityType, id]);
      expect(execute.mock.calls.length).toBeGreaterThan(1);
    },
  );
  it('does not read metadata for an unrelated entity', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ allowed: false }] });
    await expect(
      evidencePage(execute, actor, { entityType: 'farm', entityId: id }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('binds cursor to tenant, search, entity and live network scope', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: actor.organizationId }] });
    const first = await evidencePage(execute, actor, { limit: '1' });
    for (const parameters of [{ search: 'different' }, { entityType: 'farm', entityId: id }]) {
      const allowed = vi.fn().mockResolvedValue({ rows: [{ allowed: true }] });
      await expect(
        evidencePage(allowed, actor, { cursor: first.nextCursor, ...parameters }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(
      evidencePage(execute, { ...actor, organizationId: id }, { cursor: first.nextCursor }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      evidencePage(
        execute,
        { ...actor, permissions: ['evidence.read.all'] },
        { cursor: first.nextCursor },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([
    { entityType: 'farm' },
    { entityId: id },
    { entityType: 'unknown', entityId: id },
    { entityType: 'farm', entityId: 'not-a-uuid' },
    { limit: '101' },
    { search: 'x'.repeat(81) },
    { unexpected: 'true' },
  ])('rejects malformed input %j', async (parameters) => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(evidencePage(execute, actor, parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses overflow rather than returning a partial compatibility list', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({})) });
    await expect(legacyEvidenceList(execute, actor, {})).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
    expect(execute.mock.calls[0][0]).toContain('LIMIT 1001');
  });
});
