import { listOfferPage, summarizeOffers } from '../modules/catalog/offers';
import { Router } from 'express';
import { z } from 'zod';
import * as cancellationController from '../controllers/cancellationController';
import { requireAuth, requireAnyPermission, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createOfferSchema, updateComplianceSchema, updateEudrSchema, updatePaymentTermsSchema } from '../validation';
import { acceptDeliverySchema, deliveryDiscrepancySchema, deliveryResolutionSchema } from '../validation';
import * as deliveryController from '../controllers/deliveryController';
import * as contractController from '../controllers/contractController';

const router = Router();

router.get('/offers', requireAuth, requireAnyPermission('offer.respond', 'offer.create'), contractController.listOffers);
router.get('/offers/page', requireAuth, requireAnyPermission('offer.respond','offer.create'), listOfferPage);
router.get('/offers/summary', requireAuth, requireAnyPermission('offer.respond','offer.create'), summarizeOffers);
router.post('/listings/:id/offers', requireAuth, requirePermission('offer.create'), validate(createOfferSchema), contractController.makeOffer);
router.post('/offers/:id/accept', requireAuth, requirePermission('offer.respond'), validate(z.object({feeRateBps:z.number().int().min(0).max(1000).optional()}).default({})), contractController.acceptOffer);
router.post('/offers/:id/reject', requireAuth, requirePermission('offer.respond'), contractController.rejectOffer);
router.get('/contracts', requireAuth, requirePermission('contract.read'), contractController.listContracts);
router.get('/contracts/:id', requireAuth, requirePermission('contract.read'), contractController.getContract);
router.patch('/contracts/:id/payment-terms', requireAuth, requirePermission('contract.read'), validate(updatePaymentTermsSchema), contractController.updatePaymentTerms);
router.post('/contracts/:id/payment-terms/confirm', requireAuth, requirePermission('contract.read'), contractController.confirmPaymentTerms);
router.patch('/contracts/:id/eudr', requireAuth, requirePermission('contract.read'), validate(updateEudrSchema), contractController.updateEudrReference);
router.patch('/contracts/:id/compliance', requireAuth, requirePermission('contract.read'), validate(updateComplianceSchema), contractController.updateComplianceReference);

router.get('/contracts/:id/delivery', requireAuth, requirePermission('contract.read'), deliveryController.get);
router.post('/contracts/:id/delivery/accept', requireAuth, requirePermission('contract.read'), validate(acceptDeliverySchema), deliveryController.accept);
router.post('/contracts/:id/delivery/discrepancy', requireAuth, requirePermission('contract.read'), validate(deliveryDiscrepancySchema), deliveryController.report);
router.post('/contracts/:id/delivery/resolution', requireAuth, requirePermission('contract.read'), validate(deliveryResolutionSchema), deliveryController.propose);
router.post('/contracts/:id/delivery/resolution/approve', requireAuth, requirePermission('contract.read'), deliveryController.approve);
router.get('/contracts/:id/cancellation', requireAuth, requirePermission('contract.read'), cancellationController.get);
router.post('/contracts/:id/cancellation', requireAuth, requirePermission('contract.read'), requireAnyPermission('offer.create', 'offer.respond'), validate(z.object({ reason: z.string().trim().min(10).max(2000) })), cancellationController.request);
router.post('/contracts/:id/cancellation/:requestId/approve', requireAuth, requirePermission('contract.read'), requireAnyPermission('offer.create', 'offer.respond'), cancellationController.approve);
router.post('/contracts/:id/cancellation/:requestId/reject', requireAuth, requirePermission('contract.read'), requireAnyPermission('offer.create', 'offer.respond'), cancellationController.reject);

export = router;
