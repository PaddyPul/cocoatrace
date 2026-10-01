import bcrypt from 'bcryptjs';
import { config } from '../src/config/env';
import { getClient, pool } from '../src/db';
import { requireDisposableTestDatabase } from '../src/testing/databaseSafety';

async function seed(): Promise<void> {
  requireDisposableTestDatabase(config.databaseUrl);
  if (config.environment !== 'test' || process.env.BROWSER_TEST_FIXTURES !== 'true'
      || new URL(config.databaseUrl).pathname !== '/cocoatrace_browser_test') {
    throw new Error('Browser fixtures require the dedicated browser test database and explicit test mode');
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const roles = await client.query(`INSERT INTO roles(name,permissions) VALUES
      ('browser_platform_admin',ARRAY['*']),
      ('exporter',ARRAY['farm.read','member.invite']),
      ('importer',ARRAY['listing.read','member.invite'])
      ON CONFLICT(name) DO UPDATE SET permissions=EXCLUDED.permissions RETURNING id,name`);
    const organization = await client.query(`INSERT INTO organizations(name,type,jurisdiction,verification_status)
      VALUES ('Browser Test Platform','regulator','GH','verified') RETURNING id`);
    const user = await client.query(`INSERT INTO users(organization_id,email,password_hash,name)
      VALUES ($1,'platform-admin@browser.test',$2,'Browser Platform Admin') RETURNING id`,
    [organization.rows[0].id, await bcrypt.hash('BrowserAdminPassword123!', 4)]);
    const role = roles.rows.find((row) => row.name === 'browser_platform_admin');
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.rows[0].id, role.id]);
    await client.query(`INSERT INTO user_onboarding(user_id,status,current_step,completed_at)
      VALUES($1,'completed',4,NOW())`, [user.rows[0].id]);
    await client.query('COMMIT');
    console.log('Disposable browser fixtures created');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
seed().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
