import 'express-async-errors';
import dotenv from 'dotenv';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import logger from './logger';
import { AppError } from './errors';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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

const app = express();

app.use(pinoHttp({ logger }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

import { query } from './db';

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
