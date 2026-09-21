import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createRecallSchema, productProfileSchema } from '../validation';
import * as controller from '../controllers/publicProductController';

const router = Router();

router.get('/public/products/:slug', controller.getPublicProduct);
router.get('/public/products/:slug/qr.svg', controller.getProductQr);
router.post('/public/products/:slug/scans', controller.recordScan);

router.get('/product-profiles', requireAuth, requirePermission('batch.read'), controller.listProductProfiles);
router.get('/product-profiles/batch/:batchId', requireAuth, requirePermission('batch.read'), controller.getProfileForBatch);
router.post('/product-profiles', requireAuth, requirePermission('batch.create'), validate(productProfileSchema), controller.upsertProfile);
router.post('/product-profiles/:id/publish', requireAuth, requirePermission('batch.create'), controller.publishProfile);

router.get('/recalls', requireAuth, requirePermission('recall.manage'), controller.listRecalls);
router.post('/recalls', requireAuth, requirePermission('recall.manage'), validate(createRecallSchema), controller.createRecall);
router.post('/recalls/:id/resolve', requireAuth, requirePermission('recall.manage'), controller.resolveRecall);

export = router;
