import path from 'path';
import dotenv from 'dotenv';
import { Pool, QueryResult, PoolClient } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString: string =
  process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

function maskConnectionString(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

console.log(`DB: ${maskConnectionString(connectionString)}`);

const pool = new Pool({ connectionString });

pool.on('error', (err: Error) => {
  console.error('Unexpected DB error', err);
});

async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_QUERIES) {
    console.log('query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { query, getClient, pool };
