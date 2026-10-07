import { Request, Response } from 'express';
import { ValidationError } from '../../errors';
import { flag, parsePage, quantity, text, withCatalogRead } from './paging';
import { holdingPage, holdingSummary, listingPage, listingSummary } from './repository';

export async function listHoldingPage(req: Request, res: Response) {
  const available = flag(req.query.available, 'available');
  const input = parsePage(
    req.query,
    ['holdings', req.user!.organizationId, available],
    ['available'],
  );
  res.json(
    await withCatalogRead((execute) =>
      holdingPage(execute, req.user!.organizationId, input, available),
    ),
  );
}
export async function listListingPage(req: Request, res: Response) {
  const id = text(req.query.id, 'listing identifier', 36);
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new ValidationError('Invalid listing identifier');
  const currency = text(req.query.currency, 'currency', 3);
  if (currency && !['EUR', 'USD', 'GHS', 'GBP', 'JPY'].includes(currency))
    throw new ValidationError('Unsupported listing currency');
  if (req.query.sort === 'price' && !currency)
    throw new ValidationError('Select one currency before comparing prices');
  const filters = {
    id,
    currency,
    mine: flag(req.query.mine, 'mine'),
    organic: flag(req.query.organic, 'organic'),
    commodity: text(req.query.commodity, 'commodity'),
    origin: text(req.query.origin, 'origin'),
    minimum: quantity(req.query.minimum),
  };
  const input = parsePage(
    req.query,
    ['listings', req.user!.organizationId, filters],
    ['mine', 'organic', 'commodity', 'origin', 'minimum', 'id', 'currency'],
    ['id', 'price', 'quantity'],
  );
  res.json(
    await withCatalogRead((execute) =>
      listingPage(execute, req.user!.organizationId, input, filters),
    ),
  );
}
export async function summarizeHoldings(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => holdingSummary(execute, req.user!.organizationId)));
}
export async function summarizeListings(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => listingSummary(execute, req.user!.organizationId)));
}
