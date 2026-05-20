import path from 'path';
import dotenv from 'dotenv';
import { Pool, QueryResult, PoolClient } from 'pg';
import logger from './logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString: string =
  process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

const pool = new Pool({ connectionString });

pool.on('error', (err: Error) => {
  logger.error({ err }, 'Unexpected DB error');
});

async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_QUERIES) {
    logger.debug({ text: text.slice(0, 80), duration, rows: res.rowCount }, 'query');
  }
  return res;
}

async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { query, getClient, pool };
