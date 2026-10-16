import { describe, expect, it, vi } from 'vitest';
import { editSourcingRequest, editSourcingSchema } from './edit';
const id = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
describe('reviewed saved sourcing edits', () => {
  it('updates reviewed requirements on the same tenant-owned mutable record and supports clearing dates', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: [{ id, commodity: 'peanut', quantity_kg: '43.000' }] });
    const result = await editSourcingRequest(execute, { organizationId: org }, id, {
      commodity: 'peanut',
      quantityKg: 43,
      requiredBy: null,
      offerDeadline: null,
      qualityRequirements: { notes: 'new specification' },
    });
    expect(result).toMatchObject({ id, commodity: 'peanut' });
    expect(execute.mock.calls[0][0]).toContain("AND status IN ('draft','open')");
    expect(execute.mock.calls[0][0]).toContain('buyer_organization_id=$7');
    expect(execute.mock.calls[0][1]).toEqual([
      'peanut',
      43,
      { notes: 'new specification' },
      null,
      null,
      id,
      org,
    ]);
  });
  it('does not disclose or edit an unrelated or terminal record', async () => {
    await expect(
      editSourcingRequest(vi.fn().mockResolvedValue({ rows: [] }), { organizationId: org }, id, {
        title: 'Reviewed title',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('rejects invalid quantities, keys, statuses and identifiers before mutation', async () => {
    for (const body of [
      { quantityKg: 0 },
      { quantityKg: -1 },
      { quantityKg: 1.0004 },
      { quantityKg: 1e30 },
      { requiredBy: '2026-02-30' },
      { buyer_organization_id: org },
      { status: 'awarded' },
      {},
      { offerDeadline: 'tomorrow' },
    ]) {
      const execute = vi.fn();
      await expect(
        editSourcingRequest(execute, { organizationId: org }, id, body),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    }
    await expect(
      editSourcingRequest(vi.fn(), { organizationId: org }, 'not-id', { title: 'Valid' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('partial edits do not inject create defaults into existing requirements', () => {
    expect(editSourcingSchema.parse({ title: 'Renamed saved request' })).toEqual({
      title: 'Renamed saved request',
    });
  });
});
