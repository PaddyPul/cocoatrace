import { Pool } from 'pg';
import { requireDisposableTestDatabase } from '../../api/src/testing/databaseSafety';

/** Read-only assertions against the isolated browser database, never app data. */
export async function tradeSnapshot(contractId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contractId)) throw new Error('Expected a contract UUID');
  const connectionString = requireDisposableTestDatabase(process.env.COCOATRACE_BROWSER_DATABASE_URL);
  const url = new URL(connectionString);
  if (url.pathname !== '/cocoatrace_browser_test' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Trade assertions require the dedicated local browser test database');
  }
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const contract = (await pool.query('SELECT * FROM sales_contracts WHERE id=$1', [contractId])).rows[0];
    if (!contract) throw new Error('Trade fixture contract not found');
    const batch = (await pool.query('SELECT batch_id FROM batch_holdings WHERE id=$1', [contract.holding_id])).rows[0];
    const holdings = (await pool.query("SELECT * FROM batch_holdings WHERE batch_id=$1 AND status<>'transferred' ORDER BY id", [batch.batch_id])).rows;
    const payment = (await pool.query('SELECT * FROM payment_requests WHERE contract_id=$1', [contractId])).rows[0];
    const fees = (await pool.query('SELECT * FROM platform_fee_invoices WHERE contract_id=$1', [contractId])).rows;
    const shipments = (await pool.query('SELECT * FROM shipments WHERE contract_id=$1', [contractId])).rows;
    const transfers = (await pool.query("SELECT * FROM custody_transfers WHERE holding_id=$1 AND status='accepted'", [contract.holding_id])).rows;
    const distributions = (await pool.query('SELECT * FROM lot_distributions WHERE shipment_id=ANY($1::uuid[])', [shipments.map(shipment => shipment.id)])).rows;
    return { contract, holdings, payment, fees, shipments, transfers, distributions };
  } finally { await pool.end(); }
}
