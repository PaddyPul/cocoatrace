import { describe, expect, it, vi } from 'vitest';
import { privateShipmentDetail } from './privateShipmentDetail';

describe('private shipment detail', () => {
  it('scopes the initial read to contract parties and never reads history after a miss', async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    expect(await privateShipmentDetail(execute, 'shipment', 'outsider')).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]).toEqual([
      expect.stringContaining('(c.seller_organization_id=$2 OR c.buyer_organization_id=$2)'),
      ['shipment', 'outsider'],
    ]);
  });
  it.each(['seller', 'buyer'])(
    'loads authorized %s history using the same executor and returns role-specific actions',
    async (organizationId) => {
      const shipment = {
        id: 'shipment',
        incoterm: 'FOB',
        seller_organization_id: 'seller',
        buyer_organization_id: 'buyer',
        transport_coordinator_organization_id: 'buyer',
        current_milestone: 'booked',
      };
      const milestones = [{ milestone: 'booked' }];
      const execute = vi
        .fn()
        .mockResolvedValueOnce({ rows: [shipment] })
        .mockResolvedValueOnce({ rows: milestones });
      const detail = await privateShipmentDetail(execute, 'shipment', organizationId);
      expect(detail?.shipment).toEqual(shipment);
      expect(detail?.milestones).toEqual(milestones);
      expect(detail?.permissions.party).toBe(organizationId);
      expect(detail?.permissions.milestones.includes('cargo_ready')).toBe(
        organizationId === 'seller',
      );
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute.mock.calls[1][1]).toEqual(['shipment']);
    },
  );
  it('rejects oversized history instead of returning a partial shipment record', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'shipment' }] })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 1001 }, () => ({ milestone: 'booked' })),
      });
    await expect(privateShipmentDetail(execute, 'shipment', 'seller')).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
  });
});
