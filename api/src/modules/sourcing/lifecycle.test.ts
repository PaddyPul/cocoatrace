import { describe, it, expect, vi } from 'vitest';
import { closeoutSourcing, closeoutSchema } from './lifecycle';
const id = '11111111-1111-4111-8111-111111111111',
  org = '22222222-2222-4222-8222-222222222222';
const actor = { id, organizationId: org };
describe('manual sourcing closeout', () => {
  it('requires explicit review, reason and award-only contract', () => {
    for (const body of [
      { status: 'awarded', reason: 'Reviewed all allocations', confirmed: true },
      { status: 'closed', reason: 'short', confirmed: true },
      { status: 'closed', reason: 'Reviewed all allocations', confirmed: false },
      { status: 'closed', reason: 'Reviewed all allocations', confirmed: true, contractId: id },
    ])
      expect(closeoutSchema.safeParse(body).success).toBe(false);
  });
  it('locks only the buyer request, records immutable association and transitions', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ status: 'open', commodity: 'cocoa' }] })
      .mockResolvedValueOnce({ rows: [{ id, status: 'accepted', commodity: 'cocoa' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id, status: 'awarded' }] });
    expect(
      await closeoutSourcing(execute, actor, id, {
        status: 'awarded',
        reason: 'Reviewed all allocations',
        confirmed: true,
        contractId: id,
      }),
    ).toMatchObject({ status: 'awarded' });
    expect(execute.mock.calls[0][1]).toEqual([id, org]);
    expect(execute.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(execute.mock.calls[2][1]).toContain('buyer_manual');
  });
  it('hides foreign requests and prevents a second terminal outcome', async () => {
    await expect(
      closeoutSourcing(vi.fn().mockResolvedValue({ rows: [] }), actor, id, {
        status: 'closed',
        reason: 'Reviewed all allocations',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      closeoutSourcing(vi.fn().mockResolvedValue({ rows: [{ status: 'closed' }] }), actor, id, {
        status: 'closed',
        reason: 'Reviewed all allocations',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('rejects foreign, cancelled or different-commodity awards before writing', async () => {
    for (const rows of [
      [],
      [{ status: 'cancelled', commodity: 'cocoa' }],
      [{ status: 'accepted', commodity: 'coffee' }],
    ]) {
      const execute = vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ status: 'open', commodity: 'cocoa' }] })
        .mockResolvedValueOnce({ rows });
      await expect(
        closeoutSourcing(execute, actor, id, {
          status: 'awarded',
          reason: 'Reviewed all allocations',
          confirmed: true,
          contractId: id,
        }),
      ).rejects.toThrow();
      expect(execute).toHaveBeenCalledTimes(2);
    }
  });
});
