import 'express-async-errors';
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

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

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
