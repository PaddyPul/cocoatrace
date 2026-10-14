import { Pool } from 'pg';
import { config } from '../src/config/env';
import { pool, query } from '../src/db';
import { runAlertCycle } from '../src/modules/operations/alerts';

async function run() {
  const mode = process.argv[2];
  if (mode === '--operators') {
    const rows =
      await query(`SELECT DISTINCT u.id,u.name,u.email FROM users u JOIN organizations o ON o.id=u.organization_id
      JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND '*'=ANY(r.permissions)
      ORDER BY u.id LIMIT 6`);
    console.log(
      JSON.stringify({ items: rows.rows.slice(0, 5), more: rows.rows.length > 5 }, null, 2),
    );
    return;
  }
  if (mode !== '--once') throw new Error('Use --operators or --once');
  if (!config.operationsAlertsEnabled) {
    console.log(JSON.stringify({ status: 'disabled' }));
    process.exitCode = 1;
    return;
  }
  const locks = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
      : undefined,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const client = await locks.connect();
    try {
      const status = await runAlertCycle(client);
      console.log(JSON.stringify({ status }));
      process.exitCode = status === 'failed' ? 1 : 0;
    } finally {
      client.release();
    }
  } finally {
    await locks.end();
  }
}
void run()
  .catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'OPERATIONS_ALERT_CLI_FAILED' }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
