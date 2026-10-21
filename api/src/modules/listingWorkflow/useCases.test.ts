import { describe, expect, it, vi } from 'vitest';
import { listingUseCases } from './useCases';
import type { CurrentListingRow, HoldingRow, ListingRepository, ListingTransaction } from './types';

const actor = { id: 'user', organizationId: 'seller' };
const listing: CurrentListingRow = {
  id: 'listing',
  seller_organization_id: 'seller',
  holding_id: 'holding',
  available_quantity_kg: '4',
  price_per_kg: '10',
  currency: 'USD',
  incoterm: 'FOB',
  origin_location: 'origin',
  destination_location: 'destination',
  active: true,
  expires_at: null,
  listing_expired: false,
};
const holding: HoldingRow = {
  id: 'holding',
  batch_id: 'batch',
  holder_organization_id: 'seller',
  status: 'available',
  quantity_kg: '10',
};
function fixture() {
  const tx = {
    lockRecallBoundary: vi.fn(async () => {}),
    findOwnedHolding: vi.fn(async () => holding),
    discoverHolding: vi.fn(async (): Promise<string | undefined> => 'holding'),
    lockHolding: vi.fn(async () => holding),
    lockListings: vi.fn(async () => {}),
    findOwnedListing: vi.fn(async (): Promise<CurrentListingRow | undefined> => listing),
    assertNotRecalled: vi.fn(async () => {}),
    publishedQuantity: vi.fn(async () => 3),
    pendingQuantity: vi.fn(async () => 2),
    insert: vi.fn(async () => listing),
    update: vi.fn(async () => listing),
    withdraw: vi.fn(async () => {}),
    reconcile: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
  } satisfies ListingTransaction;
  const repository: ListingRepository = {
    detail: vi.fn(async () => undefined),
    trust: vi.fn(),
    transaction: vi.fn(async (work) => work(tx)),
  };
  return { tx, repository, cases: listingUseCases(repository) };
}
describe('listing workflow', () => {
  it('reserves published stock and pending transfers using gram precision before publication', async () => {
    const { cases, tx } = fixture();
    await expect(
      cases.publishListing(actor, {
        holdingId: 'holding',
        availableQuantityKg: 5.001,
        pricePerKg: 10,
      }),
    ).rejects.toMatchObject({
      kind: 'insufficient',
      message: 'Only 5 kg remains available to publish',
    });
    expect(tx.insert).not.toHaveBeenCalled();
    await cases.publishListing(actor, {
      holdingId: 'holding',
      availableQuantityKg: 5,
      pricePerKg: 10,
    });
    expect(tx.findOwnedHolding).toHaveBeenCalledWith('holding', 'seller');
    expect(tx.audit).toHaveBeenCalledWith(actor, 'listing.create', 'listing');
    expect(tx.lockRecallBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      tx.findOwnedHolding.mock.invocationCallOrder[0],
    );
    expect(tx.lockListings.mock.invocationCallOrder[0]).toBeLessThan(
      tx.publishedQuantity.mock.invocationCallOrder[0],
    );
  });
  it('rechecks ownership and holding identity after waiting for inventory locks', async () => {
    const { cases, tx } = fixture();
    tx.findOwnedListing.mockResolvedValue({ ...listing, holding_id: 'moved' });
    await expect(cases.editListing(actor, 'listing', { pricePerKg: 11 })).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'Inventory changed; refresh before editing',
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.audit).not.toHaveBeenCalled();
    expect(tx.discoverHolding).toHaveBeenCalledWith('listing', 'seller');
    expect(tx.lockHolding.mock.invocationCallOrder[0]).toBeLessThan(
      tx.findOwnedListing.mock.invocationCallOrder[0],
    );
  });
  it('blocks continued publication of expired or recalled stock while permitting withdrawal', async () => {
    const { cases, tx } = fixture();
    tx.findOwnedListing.mockResolvedValue({ ...listing, listing_expired: true });
    await expect(cases.editListing(actor, 'listing', { pricePerKg: 11 })).rejects.toMatchObject({
      code: 'LISTING_EXPIRED',
    });
    expect(tx.update).not.toHaveBeenCalled();
    await cases.editListing(actor, 'listing', { active: false });
    expect(tx.assertNotRecalled).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith('listing', undefined, 4, false);
    expect(tx.reconcile).toHaveBeenCalledWith('holding', 8);
    expect(tx.audit).toHaveBeenCalledWith(actor, 'listing.update', 'listing');
  });
  it('propagates recall rejection before a publication write', async () => {
    const { cases, tx } = fixture();
    tx.assertNotRecalled.mockRejectedValue(new Error('recalled'));
    await expect(cases.editListing(actor, 'listing', {})).rejects.toThrow('recalled');
    expect(tx.update).not.toHaveBeenCalled();
  });
  it('validates edits before opening a transaction and scopes discovery to seller', async () => {
    const { cases, repository, tx } = fixture();
    await expect(
      cases.editListing(actor, 'listing', { availableQuantityKg: '4' }),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(repository.transaction).not.toHaveBeenCalled();
    tx.discoverHolding.mockResolvedValue(undefined);
    await expect(cases.withdrawListing(actor, 'listing')).rejects.toMatchObject({
      kind: 'not_found',
    });
    expect(tx.withdraw).not.toHaveBeenCalled();
  });
  it('withdraws without deleting referenced listings and reconciles reservations before audit', async () => {
    const { cases, tx } = fixture();
    expect(await cases.withdrawListing(actor, 'listing')).toEqual({ deleted: true });
    expect(tx.withdraw).toHaveBeenCalledWith('listing');
    expect(tx.reconcile).toHaveBeenCalledWith('holding', 8);
    expect(tx.assertNotRecalled).not.toHaveBeenCalled();
    expect(tx.reconcile.mock.invocationCallOrder[0]).toBeLessThan(
      tx.audit.mock.invocationCallOrder[0],
    );
    expect(tx.audit).toHaveBeenCalledWith(actor, 'listing.delete', 'listing');
  });
});
