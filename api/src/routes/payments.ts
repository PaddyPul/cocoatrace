import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createPaymentRequestSchema, payPaymentSchema } from '../validation';
import * as paymentController from '../controllers/paymentController';

const router = Router();

router.get('/payment-requests', requireAuth, requirePermission('payment.read'), paymentController.listPaymentRequests);
router.get('/payment-requests/:id', requireAuth, requirePermission('payment.read'), paymentController.getPaymentRequest);
router.post('/contracts/:id/payment-requests', requireAuth, requirePermission('payment.request'), validate(createPaymentRequestSchema), paymentController.createPaymentRequest);
router.post('/payment-requests/:id/pay', requireAuth, requirePermission('payment.confirm'), validate(payPaymentSchema), paymentController.payPaymentRequest);

export = router;
