import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createListingSchema, updateListingSchema } from '../validation';
import * as listingController from '../controllers/listingController';

const router = Router();

router.get('/listings', requireAuth, requirePermission('listing.read'), listingController.listListings);
router.get('/listings/:id', requireAuth, requirePermission('listing.read'), listingController.getListing);
router.post('/listings', requireAuth, requirePermission('listing.create'), validate(createListingSchema), listingController.createListing);
router.patch('/listings/:id', requireAuth, requirePermission('listing.create'), validate(updateListingSchema), listingController.updateListing);
router.delete('/listings/:id', requireAuth, requirePermission('listing.create'), listingController.deleteListing);

export = router;
