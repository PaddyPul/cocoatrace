import { Pool } from 'pg';
import { requireDisposableTestDatabase } from '../../api/src/testing/databaseSafety';

export async function expireVerification(email: string): Promise<void> {
  const connectionString = requireDisposableTestDatabase(process.env.COCOATRACE_BROWSER_DATABASE_URL);
  const url = new URL(connectionString);
  if (url.pathname !== '/cocoatrace_browser_test' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Browser expiry fixtures may address only the dedicated local test database');
  }
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`UPDATE organization_access_applications
      SET verification_expires_at=NOW()-INTERVAL '1 minute'
      WHERE admin_email=$1 AND status='pending_email_verification'`, [email]);
  } finally { await pool.end(); }
}
