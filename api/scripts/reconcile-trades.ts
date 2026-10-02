import { getClient, pool } from '../src/db';
import { reconcileTradeIntegrity } from '../src/modules/trading/reconciliation';

async function run(): Promise<void> {
  const client = await getClient();
  try {
    // A single stable, read-only snapshot avoids reporting partially committed
    // workflows. This command never updates, repairs or deletes customer data.
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const issues = await reconcileTradeIntegrity(client);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: issues.length === 0, issueCount: issues.length, issues }, null, 2));
    if (issues.length) process.exitCode = 1;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
run().catch((error) => {
  console.error('Trade reconciliation failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => pool.end());
