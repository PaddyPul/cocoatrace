import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  ownsFarm: vi.fn(),
  farmPlotCount: vi.fn(),
  ownedBatch: vi.fn(),
  bestHolding: vi.fn(),
  listedQuantity: vi.fn(),
  allocatedQuantity: vi.fn(),
  lockAllocation: vi.fn(),
  createHolding: vi.fn(),
  createListing: vi.fn(),
  createHarvest: vi.fn(),
  createHarvestHolding: vi.fn(),
  createDirect: vi.fn(),
  createWarehouseHolding: vi.fn(),
  recall: vi.fn(),
  lockRecall: vi.fn(),
  lockListings: vi.fn(),
  pending: vi.fn(),
  audit: vi.fn(),
  tradeAudit: vi.fn(),
  material: vi.fn(),
}));
vi.mock('./repository', () => ({
  connectBatchWorkflow: async () => ({ query: mocks.query, release: mocks.release }),
  ownsFarm: mocks.ownsFarm,
  farmPlotCount: mocks.farmPlotCount,
  BatchRepository: class {
    ownedBatch = mocks.ownedBatch;
    bestHolding = mocks.bestHolding;
    listedQuantity = mocks.listedQuantity;
    allocatedQuantity = mocks.allocatedQuantity;
    lockAllocation = mocks.lockAllocation;
    createHolding = mocks.createHolding;
    createListing = mocks.createListing;
    createHarvest = mocks.createHarvest;
    createHarvestHolding = mocks.createHarvestHolding;
    createDirect = mocks.createDirect;
    createWarehouseHolding = mocks.createWarehouseHolding;
  },
}));
vi.mock('../recall/safety', () => ({
  lockRecallBoundary: mocks.lockRecall,
  assertBatchNotRecalled: mocks.recall,
}));
vi.mock('../../services/inventoryIntegrity', () => ({
  lockHoldingListings: mocks.lockListings,
  pendingTransferQuantity: mocks.pending,
}));
vi.mock('../../services/materialLot', () => ({ ensureSourceMaterialLot: mocks.material }));
vi.mock('../../services/audit', () => ({ record: mocks.audit }));
vi.mock('../trading/transaction', () => ({ recordTradeAudit: mocks.tradeAudit }));
import { publishBatchInventory, registerHarvestBatch, registerDirectInventory } from './useCases';
const actor = { id: 'user', organizationId: 'organization' };
const listing = {
  quantityKg: 2,
  pricePerKg: 5,
  currency: 'USD',
  incoterm: 'FOB',
  originLocation: 'A',
  destinationLocation: 'B',
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({ rows: [] });
});
describe('batch workflow invariants', () => {
  it('checks farm ownership before opening a transaction', async () => {
    mocks.ownsFarm.mockResolvedValue(false);
    await expect(
      registerHarvestBatch(actor, {
        farmId: 'farm',
        crop: 'cocoa',
        harvestDate: '2026-01-01',
        quantityKg: 2,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rolls back unauthorized publication and releases the connection', async () => {
    await expect(publishBatchInventory(actor, 'batch', listing)).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('does not mint stock already allocated to other holdings', async () => {
    mocks.ownedBatch.mockResolvedValue({ id: 'batch', quantity_kg: '10' });
    mocks.allocatedQuantity.mockResolvedValue(9);
    await expect(publishBatchInventory(actor, 'batch', listing)).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_INVENTORY',
    });
    expect(mocks.createHolding).not.toHaveBeenCalled();
  });
  it('subtracts reservations and active listings using grams', async () => {
    mocks.ownedBatch.mockResolvedValue({ id: 'batch', quantity_kg: '10' });
    mocks.bestHolding.mockResolvedValue({ id: 'holding', quantity_kg: '5' });
    mocks.pending.mockResolvedValue(2);
    mocks.listedQuantity.mockResolvedValue(1.001);
    await expect(publishBatchInventory(actor, 'batch', listing)).rejects.toMatchObject({
      message: 'Only 1.999 kg remains available to publish',
    });
    expect(mocks.createListing).not.toHaveBeenCalled();
    expect(mocks.lockAllocation).not.toHaveBeenCalled();
  });
  it('commits listing audit atomically and releases on audit failure', async () => {
    mocks.ownedBatch.mockResolvedValue({ id: 'batch' });
    mocks.bestHolding.mockResolvedValue({ id: 'holding', quantity_kg: 5 });
    mocks.pending.mockResolvedValue(0);
    mocks.listedQuantity.mockResolvedValue(0);
    mocks.createListing.mockResolvedValue({ id: 'listing' });
    mocks.tradeAudit.mockRejectedValue(new Error('audit failed'));
    await expect(publishBatchInventory(actor, 'batch', listing)).rejects.toThrow('audit failed');
    expect(mocks.query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('retains direct inventory post-commit audit semantics', async () => {
    mocks.createDirect.mockResolvedValue({ id: 'batch' });
    mocks.createWarehouseHolding.mockResolvedValue({ id: 'holding' });
    mocks.audit.mockImplementation(async () => {
      expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
    });
    await expect(
      registerDirectInventory(actor, {
        commodity: 'cocoa',
        quantityKg: 2,
        inventoryDate: '2026-01-01',
        sourceCountry: 'GH',
      }),
    ).resolves.toEqual({ id: 'batch', holding_id: 'holding' });
    expect(mocks.material).toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
