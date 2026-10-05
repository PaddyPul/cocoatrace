import { requireSameCurrency } from './tradeMoney';
import type { PoolClient } from 'pg';
import { makeFeeDue } from '../modules/fees/lifecycle';
import type { TradeActor } from '../modules/trading/transaction';

export async function completeTradeIfReady(client: PoolClient, contractId: string, actor: TradeActor): Promise<boolean> {
  const result = await client.query(
    `SELECT c.*, sh.current_milestone, p.status AS payment_status, p.currency AS payment_currency
       FROM sales_contracts c
       LEFT JOIN LATERAL (SELECT current_milestone FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) sh ON TRUE
       LEFT JOIN LATERAL (SELECT status,currency FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) p ON TRUE
      WHERE c.id=$1 FOR UPDATE OF c`, [contractId]);
  const contract = result.rows[0];
  if (!contract || contract.status === 'settled' || contract.current_milestone !== 'delivered' || contract.payment_status !== 'settled') return false;
  requireSameCurrency(contract.currency, contract.payment_currency);
  const delivery = await client.query(`SELECT a.contract_id FROM delivery_acceptances a WHERE a.contract_id=$1
    AND a.received_quantity_kg=$2::numeric AND a.accepted_by_organization_id=$3
    AND NOT EXISTS(SELECT 1 FROM delivery_discrepancies d WHERE d.contract_id=a.contract_id AND d.status<>'resolved')`, [contractId, contract.quantity_kg, contract.buyer_organization_id]);
  if (!delivery.rows[0]) return false;
  const issue = await client.query("SELECT pi.id FROM payment_issues pi JOIN payment_requests p ON p.id=pi.payment_request_id WHERE p.contract_id=$1 AND pi.status<>'resolved' LIMIT 1", [contractId]);
  if (issue.rows[0]) return false;
  const holding = await client.query("SELECT id FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 AND status='committed' AND quantity_kg=$3::numeric FOR UPDATE", [contract.holding_id, contract.seller_organization_id, contract.quantity_kg]);
  if (!holding.rows[0]) return false;
  await client.query(`INSERT INTO custody_transfers (holding_id, from_organization_id, to_organization_id, quantity_kg, status, responded_at)
    SELECT c.holding_id,c.seller_organization_id,c.buyer_organization_id,c.quantity_kg,'accepted',NOW() FROM sales_contracts c WHERE c.id=$1
    AND NOT EXISTS (SELECT 1 FROM custody_transfers ct WHERE ct.holding_id=c.holding_id AND ct.to_organization_id=c.buyer_organization_id AND ct.status='accepted')`, [contractId]);
  await client.query(`UPDATE batch_holdings h SET holder_organization_id=c.buyer_organization_id,status='available' FROM sales_contracts c
    WHERE c.id=$1 AND h.id=c.holding_id AND h.holder_organization_id=c.seller_organization_id`, [contractId]);
  await client.query("UPDATE sales_contracts SET status='settled',completed_at=NOW() WHERE id=$1", [contractId]);
  await makeFeeDue(client, actor, contractId);
  return true;
}
