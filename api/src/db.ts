import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';
import logger from './logger';
import { observeDatabaseClient } from './modules/operations/observeDatabaseClient';
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

pool.on('connect', (client: PoolClient) => {
  observeDatabaseClient(client);
});

pool.on('error', (err: Error) => {
  logger.error({ err }, 'Unexpected DB error');
});

async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<Row>> {
  const start = Date.now();
  const res = await pool.query<Row>(text, params);
  const duration = Date.now() - start;
  if (config.logQueries) {
    logger.debug({ text: text.slice(0, 80), duration, rows: res.rowCount }, 'query');
  }
  return res;
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
