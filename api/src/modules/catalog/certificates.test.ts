import { describe, expect, it, vi } from 'vitest';
import { certificatePage, certificateSummary, legacyCertificates } from './certificates';
const actor = {
  id: 'user',
  organizationId: '11111111-1111-1111-1111-111111111111',
  permissions: ['certificate.read'],
};
const id = '22222222-2222-2222-2222-222222222222';
describe('bounded certificate register', () => {
  it('preserves parties and filters before limiting with literal search', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await certificatePage(execute, actor, {
      search: '%_',
      status: 'suspended',
      farmId: id,
      limit: '2',
    });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('sc.buyer_organization_id=$1::uuid');
    expect(sql).toContain('c.certifier_organization_id=$1::uuid');
    expect(sql).toContain('ORDER BY c.id LIMIT $8::int');
    expect(params).toEqual([
      actor.organizationId,
      false,
      id,
      'suspended',
      null,
      '%_',
      '%\\%\\_%',
      3,
    ]);
  });
  it('binds cursors to organization, permission scope and filters', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id }, { id: actor.organizationId }] });
    const page = await certificatePage(execute, actor, { limit: '1' });
    for (const [who, parameters] of [
      [actor, { status: 'revoked' }],
      [{ ...actor, permissions: ['certificate.read.all'] }, {}],
      [{ ...actor, organizationId: id }, {}],
    ] as [typeof actor, Record<string, string>][]) {
      await expect(
        certificatePage(execute, who, { ...parameters, cursor: page.nextCursor }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
  });
  it.each([
    { limit: '101' },
    { status: 'invented' },
    { farmId: 'bad' },
    { search: 'x'.repeat(81) },
    { all: 'true' },
  ])('rejects malformed input %j', async (parameters) => {
    await expect(certificatePage(vi.fn(), actor, parameters)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it('does not let generic analytics grant certificate read-all', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005 }] });
    expect(
      (await certificateSummary(execute, { ...actor, permissions: ['analytics.read.network'] }))
        .count,
    ).toBe(1005);
    expect(execute.mock.calls[0][1]).toEqual([actor.organizationId, false]);
  });
  it('legacy history refuses overflow without a partial successful response', async () => {
    await expect(
      legacyCertificates(
        vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({ id })) }),
        actor,
        {},
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'CATALOG_READ_LIMIT' });
  });
});
