import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), lock: vi.fn(), audit: vi.fn() }));
vi.mock('./offers', () => ({ lockOfferInventory: mocks.lock }));
vi.mock('./transaction', () => ({
  inTradeTransaction: (run: (client: unknown) => unknown) => run({ query: mocks.query }),
  recordTradeAudit: mocks.audit,
}));
import { withdrawTradeOffer } from './withdrawOffer';
const actor = { id: 'user', organizationId: 'buyer' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({ rows: [{ id: 'offer' }] });
  mocks.lock.mockResolvedValue({
    offer: { id: 'offer', buyer_organization_id: 'buyer', status: 'pending' },
  });
});
describe('pending buyer withdrawal', () => {
  it('denies foreign and absent offers before locks or mutation', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await expect(withdrawTradeOffer(actor, 'offer')).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.lock).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('rechecks buyer after lock acquisition', async () => {
    mocks.lock.mockResolvedValue({ offer: { buyer_organization_id: 'other', status: 'pending' } });
    await expect(withdrawTradeOffer(actor, 'offer')).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(['accepted', 'rejected', 'expired'])('does not revive %s offers', async (status) => {
    mocks.lock.mockResolvedValue({ offer: { buyer_organization_id: 'buyer', status } });
    await expect(withdrawTradeOffer(actor, 'offer')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('replays a completed withdrawal without duplicate mutation or audit', async () => {
    mocks.lock.mockResolvedValue({
      offer: { buyer_organization_id: 'buyer', status: 'cancelled' },
    });
    expect(await withdrawTradeOffer(actor, 'offer')).toMatchObject({ status: 'cancelled' });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('writes terminal status and audit inside the same transaction', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: 'offer' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'offer', status: 'cancelled' }] });
    expect(await withdrawTradeOffer(actor, 'offer')).toMatchObject({ status: 'cancelled' });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      'offer.withdraw',
      'trade_offer',
      'offer',
      { previousStatus: 'pending', newStatus: 'cancelled' },
    );
  });
});
