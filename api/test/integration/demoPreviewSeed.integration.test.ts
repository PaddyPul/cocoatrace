import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {Pool} from 'pg';
import {expect,it} from 'vitest';

it('preview seed is compatible with forward migrations and leaves functional identities with no inherited inventory',async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query(fs.readFileSync(path.resolve(__dirname,'../../../db/seed.sql'),'utf8'));
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query(fs.readFileSync(path.resolve(__dirname,'../../../db/demo-prune-fresh.sql'),'utf8'));
  for(const email of ['newbuyer@cocoatrace.io','newsupplier@cocoatrace.io']) {
   const {rows}=await client.query(`SELECT u.password_hash,o.verification_status FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.email=$1`,[email]);
   expect(rows).toHaveLength(1);expect(rows[0].verification_status).toBe('verified');
   expect(await bcrypt.compare('Password123!',rows[0].password_hash)).toBe(true);
  }
  for(const table of ['farms','farm_plots','harvest_batches','batch_holdings','listings','trade_offers','sales_contracts','shipments','payment_requests','evidence_items']) {
   expect(Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count),table).toBe(0);
  }
 } finally {await client.query('ROLLBACK');client.release();await pool.end();}
});
