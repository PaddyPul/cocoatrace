import { Router } from 'express';
import { requireAuth, requireAnyPermission, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createOfferSchema, updateComplianceSchema, updateEudrSchema } from '../validation';
import * as contractController from '../controllers/contractController';

const router = Router();

router.get('/offers', requireAuth, requireAnyPermission('offer.respond', 'offer.create'), contractController.listOffers);
router.post('/listings/:id/offers', requireAuth, requirePermission('offer.create'), validate(createOfferSchema), contractController.makeOffer);
router.post('/offers/:id/accept', requireAuth, requirePermission('offer.respond'), contractController.acceptOffer);
router.post('/offers/:id/reject', requireAuth, requirePermission('offer.respond'), contractController.rejectOffer);
router.get('/contracts', requireAuth, requirePermission('contract.read'), contractController.listContracts);
router.get('/contracts/:id', requireAuth, requirePermission('contract.read'), contractController.getContract);
router.patch('/contracts/:id/eudr', requireAuth, requirePermission('contract.read'), validate(updateEudrSchema), contractController.updateEudrReference);
router.patch('/contracts/:id/compliance', requireAuth, requirePermission('contract.read'), validate(updateComplianceSchema), contractController.updateComplianceReference);

export = router;
