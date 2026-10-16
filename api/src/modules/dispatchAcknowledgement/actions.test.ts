import { describe, it, expect, vi } from 'vitest';
import { loadDispatchAcknowledgementActions } from './actions';
import type { Execute } from '../catalog/paging';
describe('current exceptional dispatch notices', () => {
  const actor = { organizationId: 'buyer', permissions: ['shipment.read', 'shipment.update'] };
  const row = {
    id: 'shipment',
    contract_id: 'contract',
    buyer_organization_id: 'buyer',
    seller_organization_id: 'seller',
    dispatch_exception_reason: 'Risk reviewed',
    dispatch_exception_recorded_at: '2026-10-16T00:00:00Z',
  };
  it('does not query without current read authority and fails before receipt query on overflow', async () => {
    const execute = vi.fn<Execute>().mockResolvedValue({ rows: Array(1001).fill(row) });
    expect(
      await loadDispatchAcknowledgementActions({ ...actor, permissions: [] }, execute),
    ).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    await expect(loadDispatchAcknowledgementActions(actor, execute)).rejects.toMatchObject({
      code: 'NOTIFICATION_SOURCE_LIMIT',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('binds notice identity to exception changes and limits action to an authorized buyer', async () => {
    const execute = vi
      .fn<Execute>()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    const first = await loadDispatchAcknowledgementActions(actor, execute);
    expect(first[0]).toMatchObject({ requiresAction: true, actionPath: '/shipments/shipment' });
    const changed = vi
      .fn<Execute>()
      .mockResolvedValueOnce({ rows: [{ ...row, dispatch_exception_reason: 'New reason' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      (
        await loadDispatchAcknowledgementActions({ ...actor, organizationId: 'seller' }, changed)
      )[0],
    ).toMatchObject({ requiresAction: false });
    const changedAgain = vi
      .fn<Execute>()
      .mockResolvedValueOnce({ rows: [{ ...row, dispatch_exception_reason: 'New reason' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect((await loadDispatchAcknowledgementActions(actor, changedAgain))[0].id).not.toBe(
      first[0].id,
    );
  });
});
