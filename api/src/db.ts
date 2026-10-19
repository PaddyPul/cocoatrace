import { Pool, QueryResult, PoolClient } from 'pg';
import logger from './logger';
import { runtimeMetrics } from './modules/operations/runtimeMetrics';
import { config } from './config/env';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl
    ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
    : undefined,
  max: config.databasePoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err: Error) => {
  logger.error({ err }, 'Unexpected DB error');
});

async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  let failed = true;
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.logQueries) {
      logger.debug({ text: text.slice(0, 80), duration, rows: res.rowCount }, 'query');
    }
    failed = false;
    return res;
  } finally {
    runtimeMetrics.recordQuery(Date.now() - start, failed);
  }
}

async function getClient(): Promise<PoolClient> {
  const started = performance.now();
  let failed = true;
  try {
    const client = await pool.connect();
    failed = false;
    return client;
  } finally {
    runtimeMetrics.recordAcquisition(performance.now() - started, failed);
  }
}

export { query, getClient, pool };
