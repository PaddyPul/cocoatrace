import { describe, expect, it, vi } from 'vitest';
import { readRecallResponse, responseCollection, responseInputs } from './recallResponseRead';
const actor = { id: 'actor', organizationId: 'tenant', permissions: ['evidence.read'] };
const id = 'notice';
describe('bounded recall response collections', () => {
  it('binds each collection cursor to actor, recall, current permissions and search', () => {
    const inputs = responseInputs({ limit: '3', holdingsSearch: '%_' }, actor, id, false);
    expect(inputs.holdings.limit).toBe(3);
    expect(inputs.holdings.scope).not.toBe(inputs.participants.scope);
    expect(inputs.holdings.scope).not.toBe(
      responseInputs(
        { limit: '3', holdingsSearch: '%_' },
        { ...actor, organizationId: 'foreign' },
        id,
        false,
      ).holdings.scope,
    );
    expect(inputs.holdings.scope).not.toBe(
      responseInputs({ limit: '3', holdingsSearch: '%_' }, { ...actor, permissions: [] }, id, false)
        .holdings.scope,
    );
    expect(() => responseInputs({ limit: '101' }, actor, id, false)).toThrow();
    expect(() => responseInputs({ unknown: 'true' }, actor, id, false)).toThrow();
    expect(() => responseInputs({ selectedHoldingId: 'invalid' }, actor, id, false)).toThrow();
    expect(() => responseInputs({ holdingsSearch: ['search'] }, actor, id, false)).toThrow();
  });
  it.each(['participants', 'holdings', 'recoveries', 'evidence'] as const)(
    'limits %s candidate IDs before projections and types every bind',
    async (name) => {
      const execute = vi.fn().mockResolvedValue({ rows: [] });
      const inputs = responseInputs({ limit: '3', [`${name}Search`]: '%_' }, actor, id, false);
      await responseCollection(execute, name, [id, false, 'tenant', true], inputs[name]);
      const [sql, parameters] = execute.mock.calls[0];
      expect(sql).toContain('candidates AS MATERIALIZED');
      expect(sql).toContain('LIMIT $8::int');
      expect(parameters).toEqual([id, false, 'tenant', true, null, '%_', '%\\%\\_%', 4]);
      for (let index = 1; index <= 8; index++)
        expect(sql).toMatch(new RegExp('\\$' + index + '::'));
      if (name === 'evidence') {
        expect(sql).toContain("e.validation_status='validated'");
        expect(sql).toContain("e.malware_scan_status='clean'");
        expect(sql).not.toContain('storage_key');
      }
    },
  );
  it('refuses unrelated notice before any collection reads', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(readRecallResponse(execute, actor, id, { limit: '3' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('rejects legacy overflow before outbox or recovery hydration', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id, initiated_by_organization_id: 'tenant' }] })
      .mockResolvedValueOnce({ rows: Array(1001).fill({ id }) });
    await expect(readRecallResponse(execute, actor, id)).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
      statusCode: 422,
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1][0]).not.toContain('recall_email_outbox');
    expect(execute.mock.calls[1][0]).not.toContain('row_to_json');
  });
  it('returns full scoped counts rather than treating page lengths as totals', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id, initiated_by_organization_id: 'foreign' }] });
    for (let i = 0; i < 4; i++)
      execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 1005 }] });
    const response = await readRecallResponse(execute, actor, id, { limit: '3' });
    expect(response).toMatchObject({
      canManage: false,
      myOrganizationId: 'tenant',
      participants: [],
      holdings: [],
      recoveries: [],
      evidence: [],
      paging: { participants: { count: 1005, hasMore: false, nextCursor: null } },
    });
  });
});
