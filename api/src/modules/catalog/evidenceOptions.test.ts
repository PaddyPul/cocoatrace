import { describe, expect, it, vi } from 'vitest';
vi.mock('../trust/assessment', () => ({
  loadBatchTrust: vi.fn(async () => new Map()),
  legacyOrganicStatus: vi.fn(),
}));
import { evidenceOptions } from './evidenceOptions';
const actor = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: ['farm.read', 'batch.read', 'contract.read', 'shipment.read'],
};
const id = '22222222-2222-2222-2222-222222222222';
describe('permitted paged evidence record options', () => {
  it.each(['farm', 'batch', 'contract', 'shipment'])(
    'projects only id and label for %s records',
    async (kind) => {
      const execute = vi.fn().mockResolvedValue({
        rows: [
          {
            id,
            name: 'Source farm',
            crop: 'shea',
            status: 'accepted',
            current_milestone: 'planning',
            storage_key: 'private',
            price_per_kg: '99',
          },
        ],
      });
      const result = await evidenceOptions(execute, actor, { kind });
      expect(result.items).toHaveLength(1);
      expect(Object.keys(result.items[0]).sort()).toEqual(['id', 'label']);
      expect(result.items[0].id).toBe(id);
      expect(result.items[0].label).toBeTruthy();
    },
  );
  it.each(['contract', 'shipment'])(
    'types every %s page parameter and filters both parties before LIMIT',
    async (kind) => {
      const execute = vi.fn().mockResolvedValue({ rows: [] });
      await evidenceOptions(execute, actor, { kind, search: '%_', limit: '2' });
      const [sql, parameters] = execute.mock.calls[0];
      for (let index = 1; index <= 6; index++) expect(sql).toContain(`$${index}::`);
      expect(sql).toContain(
        'c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid',
      );
      expect(sql).not.toContain('logistics_organization_id=');
      expect(sql).not.toContain('SELECT *');
      expect(parameters).toEqual([actor.organizationId, null, null, '%_', '%\\%\\_%', 3]);
    },
  );
  it.each(['farm', 'batch', 'contract', 'shipment'])(
    'uses exact id inside the %s selection boundary',
    async (kind) => {
      const execute = vi.fn().mockResolvedValue({ rows: [] });
      expect(await evidenceOptions(execute, actor, { kind, id })).toEqual({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      expect(execute.mock.calls[0][0]).toContain('id=$3::uuid');
      expect(execute.mock.calls[0][1]).toContain(id);
    },
  );
  it('retains the source list policy and named network scope for exact farm lookup', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await evidenceOptions(
      execute,
      { ...actor, permissions: ['farm.read', 'farm.read.all'] },
      { kind: 'farm', id },
    );
    expect(execute.mock.calls[0][0]).toContain('f.cooperative_organization_id=$1::uuid');
    expect(execute.mock.calls[0][1]).toEqual([actor.organizationId, true, id]);
  });
  it.each(['farm', 'batch', 'contract', 'shipment'])(
    'requires its own %s read permission before querying',
    async (kind) => {
      const execute = vi.fn();
      await expect(
        evidenceOptions(
          execute,
          { ...actor, permissions: ['evidence.upload', 'evidence.read.all'] },
          { kind },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it('binds trade cursor to kind, organization and search', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { id, status: 'accepted' },
        { id: actor.organizationId, status: 'accepted' },
      ],
    });
    const first = await evidenceOptions(execute, actor, { kind: 'contract', limit: '1' });
    for (const parameters of [{ kind: 'shipment' }, { kind: 'contract', search: 'changed' }])
      await expect(
        evidenceOptions(execute, actor, { ...parameters, cursor: first.nextCursor }),
      ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      evidenceOptions(
        execute,
        { ...actor, organizationId: id },
        { kind: 'contract', cursor: first.nextCursor },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([
    { kind: 'unsupported' },
    { kind: 'farm', id: 'bad' },
    { kind: 'farm', id, search: 'extra' },
    { kind: 'contract', id, cursor: 'extra' },
    { kind: 'shipment', limit: '101' },
    { kind: 'farm', unexpected: 'true' },
  ])('rejects ambiguous or malformed input %j', async (parameters) => {
    const execute = vi.fn();
    await expect(evidenceOptions(execute, actor, parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
