import type { PoolClient } from 'pg';

export async function completeTradeIfReady(client: PoolClient, contractId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT c.*, sh.current_milestone, p.status AS payment_status
       FROM sales_contracts c
       LEFT JOIN LATERAL (SELECT current_milestone FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) sh ON TRUE
       LEFT JOIN LATERAL (SELECT status FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) p ON TRUE
      WHERE c.id=$1 FOR UPDATE OF c`, [contractId]);
  const contract = result.rows[0];
  if (!contract || contract.status === 'settled' || contract.current_milestone !== 'delivered' || contract.payment_status !== 'settled') return false;
  const issue = await client.query("SELECT pi.id FROM payment_issues pi JOIN payment_requests p ON p.id=pi.payment_request_id WHERE p.contract_id=$1 AND pi.status<>'resolved' LIMIT 1", [contractId]);
  if (issue.rows[0]) return false;
  await client.query(`INSERT INTO custody_transfers (holding_id, from_organization_id, to_organization_id, quantity_kg, status, responded_at)
    SELECT c.holding_id,c.seller_organization_id,c.buyer_organization_id,c.quantity_kg,'accepted',NOW() FROM sales_contracts c WHERE c.id=$1
    AND NOT EXISTS (SELECT 1 FROM custody_transfers ct WHERE ct.holding_id=c.holding_id AND ct.to_organization_id=c.buyer_organization_id AND ct.status='accepted')`, [contractId]);
  await client.query(`UPDATE batch_holdings h SET holder_organization_id=c.buyer_organization_id,status='available' FROM sales_contracts c
    WHERE c.id=$1 AND h.id=c.holding_id AND h.holder_organization_id=c.seller_organization_id`, [contractId]);
  await client.query("UPDATE sales_contracts SET status='settled',completed_at=NOW() WHERE id=$1", [contractId]);
  await client.query("UPDATE platform_fee_invoices SET status='invoiced',invoiced_at=COALESCE(invoiced_at,NOW()) WHERE contract_id=$1 AND status='estimated'", [contractId]);
  return true;
}
