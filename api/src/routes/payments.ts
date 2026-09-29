import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createPaymentRequestSchema, payPaymentSchema, rejectInstallmentSchema, submitInstallmentSchema, submitPaymentSecuritySchema } from '../validation';
import * as paymentController from '../controllers/paymentController';

const router = Router();

router.get('/payment-requests', requireAuth, requirePermission('payment.read'), paymentController.listPaymentRequests);
router.get('/payment-requests/:id', requireAuth, requirePermission('payment.read'), paymentController.getPaymentRequest);
router.post('/contracts/:id/payment-requests', requireAuth, requirePermission('payment.request'), validate(createPaymentRequestSchema), paymentController.createPaymentRequest);
router.post('/payment-requests/:id/submit-documents', requireAuth, requirePermission('payment.request'), paymentController.submitPaymentDocuments);
router.post('/payment-requests/:id/pay', requireAuth, requirePermission('payment.confirm'), validate(payPaymentSchema), paymentController.payPaymentRequest);
router.post('/payment-installments/:id/submit', requireAuth, requirePermission('payment.confirm'), validate(submitInstallmentSchema), paymentController.submitInstallmentPayment);
router.post('/payment-installments/:id/confirm', requireAuth, requirePermission('payment.request'), paymentController.confirmInstallmentPayment);
router.post('/payment-installments/:id/reject', requireAuth, requirePermission('payment.request'), validate(rejectInstallmentSchema), paymentController.rejectInstallmentPayment);
router.post('/payment-requests/:id/security', requireAuth, requirePermission('payment.confirm'), validate(submitPaymentSecuritySchema), paymentController.submitPaymentSecurity);
router.post('/payment-requests/:id/security/confirm', requireAuth, requirePermission('payment.request'), paymentController.confirmPaymentSecurity);

export = router;
