import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createOfferSchema, updateEudrSchema } from '../validation';
import * as contractController from '../controllers/contractController';

const router = Router();

router.get('/offers', requireAuth, contractController.listOffers);
router.post('/listings/:id/offers', requireAuth, requirePermission('offer.create'), validate(createOfferSchema), contractController.makeOffer);
router.post('/offers/:id/accept', requireAuth, requirePermission('offer.respond'), contractController.acceptOffer);
router.post('/offers/:id/reject', requireAuth, requirePermission('offer.respond'), contractController.rejectOffer);
router.get('/contracts', requireAuth, contractController.listContracts);
router.get('/contracts/:id', requireAuth, contractController.getContract);
router.patch('/contracts/:id/eudr', requireAuth, validate(updateEudrSchema), contractController.updateEudrReference);

export = router;
