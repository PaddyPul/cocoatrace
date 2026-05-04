#!/usr/bin/env node
// api/scripts/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Try dotenv but don't fail if it's missing
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://cocoa:cocoa_dev@127.0.0.1:5432/cocoatrace';

  console.log('Running schema migration...');
  console.log('DB:', connectionString.replace(/:([^:@]+)@/, ':***@'));

  const pool = new Pool({ connectionString });
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../db/schema.sql'), 'utf8'
    );
    await pool.query(sql);
    console.log('✓ Schema applied');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
