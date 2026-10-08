import { listProductPage, summarizeProducts } from '../modules/catalog/productProfiles';
import { publicActionLimiter } from '../middleware/publicRateLimit';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createRecallSchema, productProfileSchema, acknowledgeRecallSchema, contactRecallSchema, recallRecoverySchema, resolveRecallSchema } from '../validation';
import * as controller from '../controllers/publicProductController';

import * as recallResponse from '../controllers/recallResponseController';
const router = Router();

router.get('/public/products/:slug', publicActionLimiter('profile'), controller.getPublicProduct);
router.get('/public/products/:slug/qr.svg', publicActionLimiter('qr'), controller.getProductQr);
router.post('/public/products/:slug/scans', publicActionLimiter('scan'), controller.recordScan);

router.get('/product-profiles/page', requireAuth, requirePermission('batch.read'), listProductPage);
router.get('/product-profiles/summary', requireAuth, requirePermission('batch.read'), summarizeProducts);
router.get('/product-profiles', requireAuth, requirePermission('batch.read'), controller.listProductProfiles);
router.get('/product-profiles/batch/:batchId', requireAuth, requirePermission('batch.read'), controller.getProfileForBatch);
router.post('/product-profiles', requireAuth, requirePermission('batch.create'), validate(productProfileSchema), controller.upsertProfile);
router.post('/product-profiles/:id/publish', requireAuth, requirePermission('batch.create'), controller.publishProfile);

router.get('/recalls', requireAuth, controller.listRecalls);
router.post('/recalls', requireAuth, requirePermission('recall.manage'), validate(createRecallSchema), controller.createRecall);
router.get('/recalls/:id/response', requireAuth, recallResponse.response);
router.post('/recalls/:id/acknowledge', requireAuth, validate(acknowledgeRecallSchema), recallResponse.acknowledge);
router.patch('/recalls/:id/participants/:organizationId/contact', requireAuth, validate(contactRecallSchema), recallResponse.contact);
router.put('/recalls/:id/recovery/:holdingId', requireAuth, validate(recallRecoverySchema), recallResponse.recovery);
router.post('/recalls/:id/resolve', requireAuth, validate(resolveRecallSchema), recallResponse.resolve);

export = router;
