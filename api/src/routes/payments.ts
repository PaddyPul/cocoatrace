import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createPaymentRequestSchema, payPaymentSchema, rejectInstallmentSchema, submitInstallmentSchema, submitPaymentSecuritySchema } from '../validation';
import * as paymentController from '../controllers/paymentController';
import * as paymentOperationsController from '../controllers/paymentOperationsController';

const router = Router();

router.get('/payment-requests', requireAuth, requirePermission('payment.read'), paymentController.listPaymentRequests);
router.get('/payment-requests/:id', requireAuth, requirePermission('payment.read'), paymentController.getPaymentRequest);
router.get('/payment-requests/:id/operations', requireAuth, requirePermission('payment.read'), paymentOperationsController.operations);
router.post('/payment-requests/:id/remind', requireAuth, requirePermission('payment.read'), paymentOperationsController.remind);
router.post('/payment-requests/:id/issues', requireAuth, requirePermission('payment.read'), paymentOperationsController.openIssue);
router.post('/payment-issues/:id/propose-resolution', requireAuth, requirePermission('payment.read'), paymentOperationsController.propose);
router.post('/payment-issues/:id/approve-resolution', requireAuth, requirePermission('payment.read'), paymentOperationsController.approve);

router.post('/contracts/:id/payment-requests', requireAuth, requirePermission('payment.request'), validate(createPaymentRequestSchema), paymentController.createPaymentRequest);
router.post('/payment-requests/:id/submit-documents', requireAuth, requirePermission('payment.request'), paymentController.submitPaymentDocuments);
router.post('/payment-requests/:id/pay', requireAuth, requirePermission('payment.confirm'), validate(payPaymentSchema), paymentController.payPaymentRequest);
router.post('/payment-installments/:id/submit', requireAuth, requirePermission('payment.confirm'), validate(submitInstallmentSchema), paymentController.submitInstallmentPayment);
router.post('/payment-installments/:id/confirm', requireAuth, requirePermission('payment.request'), paymentController.confirmInstallmentPayment);
router.post('/payment-installments/:id/reject', requireAuth, requirePermission('payment.request'), validate(rejectInstallmentSchema), paymentController.rejectInstallmentPayment);
router.post('/payment-requests/:id/security', requireAuth, requirePermission('payment.confirm'), validate(submitPaymentSecuritySchema), paymentController.submitPaymentSecurity);
router.post('/payment-requests/:id/security/confirm', requireAuth, requirePermission('payment.request'), paymentController.confirmPaymentSecurity);

export = router;
