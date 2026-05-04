#!/usr/bin/env node
// api/scripts/seed.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

async function seed() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://cocoa:cocoa_dev@127.0.0.1:5432/cocoatrace';

  console.log('Running seed...');

  const pool = new Pool({ connectionString });
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../db/seed.sql'), 'utf8'
    );
    await pool.query(sql);
    console.log('✓ Seed data loaded');
    console.log('');
    console.log('Demo users (all passwords: Password123!)');
    console.log('  kwame@farm.gh         — Farmer');
    console.log('  akosua@organiccert.gh — Certifier');
    console.log('  ama@accragold.gh      — Exporter');
    console.log('  pieter@dutchcacao.nl  — Importer');
    console.log('  kofi@marecargo.gh     — Logistics');
    console.log('  ingrid@cocobod.gh     — Regulator');
    console.log('  admin@cocoatrace.io   — Admin');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
