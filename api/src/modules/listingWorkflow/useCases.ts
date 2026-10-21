import { assertListingCurrent } from '../listingLifecycle/policy';
import { legacyOrganicStatus } from '../trust/assessment';
import { ListingWorkflowError } from './types';
import type {
  EditListingInput,
  ListingActor,
  ListingRepository,
  PublishListingInput,
} from './types';

export function listingUseCases(repository: ListingRepository) {
  return {
    async getListing(id: string) {
      const listing = await repository.detail(id);
      if (!listing) throw new ListingWorkflowError('not_found', 'Listing not found');
      const trust = await repository.trust(listing.batch_id);
      return { ...listing, trust, organic_claim_status: legacyOrganicStatus(trust) };
    },
    async publishListing(actor: ListingActor, input: PublishListingInput) {
      return repository.transaction(async (tx) => {
        await tx.lockRecallBoundary();
        const holding = await tx.findOwnedHolding(input.holdingId, actor.organizationId);
        if (!holding || holding.status !== 'available')
          throw new ListingWorkflowError('unavailable', 'Holding not available');
        await tx.assertNotRecalled(holding.batch_id);
        await tx.lockListings(input.holdingId);
        const listed = await tx.publishedQuantity(input.holdingId);
        const remainingGrams =
          Math.round(Number(holding.quantity_kg) * 1000) -
          Math.round(listed * 1000) -
          Math.round((await tx.pendingQuantity(input.holdingId)) * 1000);
        if (Math.round(input.availableQuantityKg * 1000) > remainingGrams)
          throw new ListingWorkflowError(
            'insufficient',
            `Only ${Math.max(0, remainingGrams / 1000)} kg remains available to publish`,
          );
        const listing = await tx.insert(actor, input);
        await tx.audit(actor, 'listing.create', listing.id);
        return listing;
      });
    },
    async editListing(actor: ListingActor, id: string, input: EditListingInput) {
      const { pricePerKg, availableQuantityKg, active } = input;
      if (
        (pricePerKg !== undefined &&
          (typeof pricePerKg !== 'number' || !Number.isFinite(pricePerKg) || pricePerKg <= 0)) ||
        (availableQuantityKg !== undefined &&
          (typeof availableQuantityKg !== 'number' ||
            !Number.isFinite(availableQuantityKg) ||
            availableQuantityKg <= 0)) ||
        (active !== undefined && typeof active !== 'boolean')
      )
        throw new ListingWorkflowError(
          'invalid',
          'Price and quantity must be positive numbers; active must be boolean',
        );
      return repository.transaction(async (tx) => {
        await tx.lockRecallBoundary();
        const holdingId = await tx.discoverHolding(id, actor.organizationId);
        if (!holdingId) throw new ListingWorkflowError('not_found', 'Listing not found');
        const holding = await tx.lockHolding(holdingId);
        await tx.lockListings(holdingId);
        const listing = await tx.findOwnedListing(id, actor.organizationId);
        // Acceptance can move a listing while this request waits for its original holding.
        if (
          !listing ||
          listing.holding_id !== holdingId ||
          holding.holder_organization_id !== actor.organizationId ||
          holding.status !== 'available'
        )
          throw new ListingWorkflowError(
            'unavailable',
            'Inventory changed; refresh before editing',
          );
        const nextActive = (active as boolean | undefined) ?? listing.active;
        // Withdrawal remains permitted for recalled/expired stock.
        if (nextActive) {
          assertListingCurrent(listing.expires_at, listing.listing_expired);
          await tx.assertNotRecalled(holding.batch_id);
        }
        const nextQuantity =
          (availableQuantityKg as number | undefined) ?? Number(listing.available_quantity_kg);
        const sibling = await tx.publishedQuantity(holding.id, id);
        const freeGrams =
          Math.round(Number(holding.quantity_kg) * 1000) -
          Math.round(sibling * 1000) -
          Math.round((await tx.pendingQuantity(holding.id)) * 1000);
        if (nextActive && Math.round(nextQuantity * 1000) > freeGrams)
          throw new ListingWorkflowError(
            'insufficient',
            `Only ${Math.max(0, freeGrams / 1000)} kg is available`,
          );
        const updated = await tx.update(
          id,
          pricePerKg as number | undefined,
          nextQuantity,
          nextActive,
        );
        await tx.reconcile(
          holding.id,
          Number(holding.quantity_kg) - (await tx.pendingQuantity(holding.id)),
        );
        await tx.audit(actor, 'listing.update', id);
        return updated;
      });
    },
    async withdrawListing(actor: ListingActor, id: string) {
      return repository.transaction(async (tx) => {
        await tx.lockRecallBoundary();
        const holdingId = await tx.discoverHolding(id, actor.organizationId);
        if (!holdingId) throw new ListingWorkflowError('not_found', 'Listing not found');
        const holding = await tx.lockHolding(holdingId);
        await tx.lockListings(holdingId);
        const listing = await tx.findOwnedListing(id, actor.organizationId);
        if (
          !listing ||
          listing.holding_id !== holdingId ||
          holding.status !== 'available' ||
          holding.holder_organization_id !== actor.organizationId
        )
          throw new ListingWorkflowError(
            'unavailable',
            'Inventory changed; refresh before withdrawing',
          );
        // Referenced listings are retained; delete only withdraws publication.
        await tx.withdraw(id);
        await tx.reconcile(
          holding.id,
          Number(holding.quantity_kg) - (await tx.pendingQuantity(holding.id)),
        );
        await tx.audit(actor, 'listing.delete', id);
        return { deleted: true };
      });
    },
  };
}
