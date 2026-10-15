import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  audit: vi.fn(),
  status: 'pending',
  seller: 'seller',
  holder: 'seller',
}));
vi.mock('./transaction', () => ({
  inTradeTransaction: (run: (client: unknown) => unknown) => run({ query: mocks.query }),
  recordTradeAudit: mocks.audit,
}));
vi.mock('../recall/safety', () => ({
  lockRecallBoundary: vi.fn(),
  assertBatchNotRecalled: vi.fn(),
}));
vi.mock('../../services/inventoryIntegrity', () => ({
  lockHoldingListings: vi.fn(),
  pendingTransferQuantity: vi.fn(),
  reconcileHoldingListings: vi.fn(),
}));
import { rejectTradeOffer } from './offers';
const actor = { id: 'seller-user', organizationId: 'seller' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.status = 'pending';
  mocks.seller = 'seller';
  mocks.holder = 'seller';
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT l.holding_id')) return { rows: [{ holding_id: 'holding' }] };
    if (sql.startsWith('SELECT * FROM batch_holdings'))
      return { rows: [{ id: 'holding', holder_organization_id: mocks.holder }] };
    if (sql.startsWith('SELECT o.*'))
      return {
        rows: [
          {
            id: 'offer',
            holding_id: 'holding',
            seller_organization_id: mocks.seller,
            status: mocks.status,
          },
        ],
      };
    if (sql.startsWith('UPDATE trade_offers'))
      return { rows: [{ id: 'offer', status: 'rejected' }] };
    return { rows: [] };
  });
});
describe('seller rejection explanation', () => {
  it.each(['', '   ', 'x'.repeat(1001)])(
    'rejects an absent or oversized explanation before database work',
    async (reason) => {
      await expect(rejectTradeOffer(actor, 'offer', reason)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mocks.query).not.toHaveBeenCalled();
    },
  );
  it('writes the trimmed explanation in the transaction audit and response', async () => {
    expect(await rejectTradeOffer(actor, 'offer', '  Cannot meet delivery terms  ')).toEqual({
      id: 'offer',
      status: 'rejected',
      rejection_reason: 'Cannot meet delivery terms',
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      'offer.reject',
      'trade_offer',
      'offer',
      { reason: 'Cannot meet delivery terms' },
    );
  });
  it.each(['accepted', 'rejected', 'cancelled', 'expired'])(
    'does not rewrite the reason of a terminal %s offer',
    async (status) => {
      mocks.status = status;
      await expect(rejectTradeOffer(actor, 'offer', 'Replacement reason')).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(mocks.audit).not.toHaveBeenCalled();
      expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false);
    },
  );
  it.each(['seller', 'holder'])('checks current %s ownership before rejection', async (field) => {
    if (field === 'seller') mocks.seller = 'foreign';
    else mocks.holder = 'foreign';
    await expect(rejectTradeOffer(actor, 'offer', 'Reason')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
