import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import logger from './logger';
import { AppError } from './errors';
import { verifyBrowserOrigin } from './middleware/security';
import { config } from './config/env';
import { evidenceStorage } from './services/evidenceStorage';
import { evidenceMalwareScanner } from './services/evidenceMalwareScanner';
import { assignRequestId, requestLogContext } from './requestContext';

import authRoutes from './routes/auth';
import orgRoutes from './routes/organizations';
import farmRoutes from './routes/farms';
import certRoutes from './routes/certificates';
import batchRoutes from './routes/batches';
import holdingRoutes from './routes/holdings';
import listingRoutes from './routes/listings';
import contractRoutes from './routes/contracts';
import shipmentRoutes from './routes/shipments';
import paymentRoutes from './routes/payments';
import evidenceRoutes from './routes/evidence';
import provenanceRoutes from './routes/provenance';
import auditRoutes from './routes/audit';
import publicProductRoutes from './routes/publicProducts';
import traceabilityRoutes from './routes/traceability';
import workspaceRoutes from './routes/workspace';
import readinessRoutes from './routes/readiness';
import invitationRoutes from './routes/invitations';
import sourcingRoutes from './routes/sourcing';
import organizationAccessRoutes from './modules/organizationAccess';

const app = express();

app.use(pinoHttp({
  logger,
  genReqId: assignRequestId,
  customProps: (req) => requestLogContext(req),
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.webUrl, credentials: true }));
app.use(express.json());
app.use(verifyBrowserOrigin);

import { query } from './db';

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});
app.get('/health/live', (_req, res) => res.json({ status: 'ok', version: config.appVersion, environment: config.environment }));
app.get('/health/ready', async (_req, res) => {
  try {
    await Promise.all([query('SELECT 1'), evidenceStorage().healthcheck(), evidenceMalwareScanner().healthcheck()]);
    res.json({ status: 'ready', database: 'connected', evidenceStorage: 'connected', evidenceScanner: 'connected', aiNarrative: Boolean(config.openAiApiKey && config.openAiModel) });
  } catch {
    res.status(503).json({ status: 'not_ready', dependency: 'database_storage_or_evidence_scanner' });
  }
});
app.use(authRoutes);
app.use(orgRoutes);
app.use(farmRoutes);
app.use(certRoutes);
app.use(batchRoutes);
app.use(holdingRoutes);
app.use(listingRoutes);
app.use(contractRoutes);
app.use(shipmentRoutes);
app.use(paymentRoutes);
app.use(evidenceRoutes);
app.use(provenanceRoutes);
app.use(auditRoutes);
app.use(publicProductRoutes);
app.use(traceabilityRoutes);
app.use(workspaceRoutes);
app.use(readinessRoutes);
app.use(invitationRoutes);
app.use(sourcingRoutes);
app.use(organizationAccessRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if ((err as Error & { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body exceeds the configured evidence file limit', code: 'EVIDENCE_FILE_TOO_LARGE' });
    return;
  }
  if (err instanceof AppError) {
    logger.warn({ err, path: req.path, method: req.method }, 'Operational error');
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: config.isDeployed ? 'Internal server error' : err.message,
  });
});

export default app;
