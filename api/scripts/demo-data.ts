import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { assertDemoResetAllowed } from '../src/services/demoResetGuard';

export type DemoScenario = 'fresh' | 'commercial' | 'incident';

const root = path.join(__dirname, '../..');

function sql(name: string): string {
  return fs.readFileSync(path.join(root, 'db', name), 'utf8');
}

export async function resetAndSeed(scenario: DemoScenario, connectionString: string): Promise<void> {
  assertDemoResetAllowed(connectionString);
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql('demo-reset.sql'));
    await client.query(sql('seed.sql'));
    if (scenario === 'fresh') await client.query(sql('demo-prune-fresh.sql'));
    if (scenario === 'commercial') await client.query(sql('demo-prune-incident.sql'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
