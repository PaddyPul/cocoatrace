import { beforeAll } from 'vitest';
import { query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';

// Reset only the isolated suite's ephemeral counters between files. Never
// change production limits to accommodate accumulated fixture traffic.
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
