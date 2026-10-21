import { Request, Response } from 'express';
import { legacyListingList } from '../modules/catalog/repository';
import { withCatalogRead } from '../modules/catalog/paging';
import { listingRepository } from '../modules/listingWorkflow/repository';
import { listingUseCases } from '../modules/listingWorkflow/useCases';
import { ListingWorkflowError } from '../modules/listingWorkflow/types';

const listings = listingUseCases(listingRepository);

async function respond(
  res: Response,
  work: () => Promise<unknown>,
  successStatus = 200,
): Promise<void> {
  try {
    res.status(successStatus).json(await work());
  } catch (error) {
    if (!(error instanceof ListingWorkflowError)) throw error;
    const status = error.kind === 'invalid' ? 400 : error.kind === 'not_found' ? 404 : 409;
    const code =
      error.kind === 'unavailable'
        ? 'INVENTORY_UNAVAILABLE'
        : error.kind === 'insufficient'
          ? 'INSUFFICIENT_INVENTORY'
          : undefined;
    res.status(status).json({ error: error.message, ...(code ? { code } : {}) });
  }
}

export async function listListings(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(legacyListingList));
}
export async function getListing(req: Request, res: Response): Promise<void> {
  await respond(res, () => listings.getListing(req.params.id as string));
}
export async function createListing(req: Request, res: Response): Promise<void> {
  const {
    holdingId,
    availableQuantityKg,
    pricePerKg,
    currency,
    incoterm,
    originLocation,
    destinationLocation,
  } = req.body;
  await respond(
    res,
    () =>
      listings.publishListing(req.user!, {
        holdingId,
        availableQuantityKg,
        pricePerKg,
        currency,
        incoterm,
        originLocation,
        destinationLocation,
      }),
    201,
  );
}
export async function updateListing(req: Request, res: Response): Promise<void> {
  const { pricePerKg, availableQuantityKg, active } = req.body;
  await respond(res, () =>
    listings.editListing(req.user!, req.params.id as string, {
      pricePerKg,
      availableQuantityKg,
      active,
    }),
  );
}
export async function deleteListing(req: Request, res: Response): Promise<void> {
  await respond(res, () => listings.withdrawListing(req.user!, req.params.id as string));
}
