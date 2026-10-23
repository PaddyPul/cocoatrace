import { config } from '../src/config/env';
import { pool } from '../src/db';
import { assertPreviewTarget } from '../src/services/demoPreviewGuard';

async function check() {
  assertPreviewTarget(config.databaseUrl, config.environment, config.demoMode, process.env.DEMO_PREVIEW_ENABLED);
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const marker = await client.query("SELECT current_database() AS name, id FROM demo_preview_metadata WHERE id=1");
    if (marker.rows.length !== 1 || marker.rows[0].name !== 'cocoatrace_demo_preview') {
      throw new Error('Reset requires the initialized dedicated synthetic preview');
    }
    await client.query('COMMIT');
    console.log('Verified dedicated synthetic preview reset target; no database changes made by preflight');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
check().catch(() => { console.error('Synthetic reset preflight failed; no volumes may be deleted. Start the dedicated preview first and verify its marker.'); process.exitCode=1; }).finally(() => pool.end());
