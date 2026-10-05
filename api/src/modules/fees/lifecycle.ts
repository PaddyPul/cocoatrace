import type { PoolClient } from 'pg';
import { recordTradeAudit, type TradeActor } from '../trading/transaction';
/** Called inside the custody-settlement transaction, after its contract lock. */
export async function makeFeeDue(
  client: PoolClient,
  actor: TradeActor,
  contractId: string,
): Promise<void> {
  const row = (
    await client.query<{ id: string; amount_total: string; currency: string }>(
      "UPDATE platform_fee_invoices SET status='invoiced',invoiced_at=COALESCE(invoiced_at,NOW()),due_at=COALESCE(due_at,NOW()) WHERE contract_id=$1 AND status='estimated' RETURNING id,amount_total,currency",
      [contractId],
    )
  ).rows[0];
  if (row)
    await recordTradeAudit(client, actor, 'fee.statement.due', 'platform_fee_invoice', row.id, {
      contractId,
      amount: row.amount_total,
      currency: row.currency,
      trigger: 'trade_completed',
    });
}
