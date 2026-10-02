import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { recoverySchemaSql } from '../../../scripts/recovery-schema.mjs';

it('compares logical restore schemas despite catalog IDs and dropped-column slots, and detects definition loss', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const snapshot = async (schema: string) => (await client.query(
    recoverySchemaSql.replaceAll("n.nspname='public'", `n.nspname='${schema}'`)
  )).rows.map((row) => JSON.stringify(row).replaceAll(schema, 'public'));
  // Test-only constant schema names; all DDL rolls back, including on failure.
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA recovery_test_source; CREATE SCHEMA recovery_test_restored;
      SET LOCAL search_path TO recovery_test_source;
      CREATE TABLE item(id serial PRIMARY KEY, dropped text, amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(amount>=0));
      ALTER TABLE item DROP COLUMN dropped;
      CREATE INDEX item_amount ON item(amount);
      CREATE VIEW item_view AS SELECT amount FROM item;
      SET LOCAL search_path TO recovery_test_restored;
      CREATE TABLE item(id serial PRIMARY KEY, amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(amount>=0));
      CREATE INDEX item_amount ON item(amount);
      CREATE VIEW item_view AS SELECT amount FROM item;`);
    await client.query('SET LOCAL search_path TO recovery_test_source');
    const source = await snapshot('recovery_test_source');
    await client.query('SET LOCAL search_path TO recovery_test_restored');
    const restored = await snapshot('recovery_test_restored');
    expect(restored).toEqual(source);
    for (const change of [
      'ALTER TABLE item ALTER COLUMN id TYPE bigint',
      'ALTER TABLE item ALTER COLUMN amount DROP NOT NULL',
      'ALTER TABLE item ALTER COLUMN amount SET DEFAULT 1',
      'ALTER TABLE item DROP CONSTRAINT item_amount_check',
      'DROP INDEX item_amount',
      'CREATE OR REPLACE VIEW item_view AS SELECT amount FROM item WHERE amount > 1',
      'ALTER SEQUENCE item_id_seq INCREMENT BY 2',
    ]) {
      await client.query('SAVEPOINT definition_change');
      await client.query(change);
      expect(await snapshot('recovery_test_restored'), change).not.toEqual(restored);
      await client.query('ROLLBACK TO SAVEPOINT definition_change');
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
