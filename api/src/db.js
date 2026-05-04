// api/src/db.js
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load env in a predictable order:
// 1. root .env for normal repo startup
// 2. api/.env for API-only local overrides
// Existing process.env values are not overwritten.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

function maskConnectionString(url) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

console.log(`DB: ${maskConnectionString(connectionString)}`);

const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_QUERIES) {
    console.log('query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
