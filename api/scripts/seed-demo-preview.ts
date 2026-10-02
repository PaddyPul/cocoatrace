import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/env';
import { getClient, pool } from '../src/db';
import { assertPreviewTarget } from '../src/services/demoPreviewGuard';

async function prepare() {
  assertPreviewTarget(config.databaseUrl, config.environment, config.demoMode, process.env.DEMO_PREVIEW_ENABLED);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cocoatrace-demo-preview-seed'))");
    await client.query('CREATE TABLE IF NOT EXISTS demo_preview_metadata (id integer PRIMARY KEY CHECK(id=1), initialized_at timestamptz NOT NULL DEFAULT now())');
    if ((await client.query('SELECT 1 FROM demo_preview_metadata WHERE id=1')).rowCount) {
      await client.query('COMMIT');
      console.log('Preview synthetic workspace retained');
      return;
    }
    if (Number((await client.query('SELECT count(*) FROM organizations')).rows[0].count) !== 0) {
      throw new Error('Unmarked nonempty preview database: refusing to overwrite data');
    }
    const root = path.resolve(__dirname, '../../db');
    await client.query(fs.readFileSync(path.join(root, 'seed.sql'), 'utf8'));
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query(fs.readFileSync(path.join(root, 'demo-prune-fresh.sql'), 'utf8'));
    await client.query('INSERT INTO demo_preview_metadata(id) VALUES(1)');
    await client.query('COMMIT');
    console.log('Synthetic preview initialized once; buyer and supplier workspaces start empty');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
prepare().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => pool.end());
