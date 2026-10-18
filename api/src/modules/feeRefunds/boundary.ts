import type { PoolClient } from 'pg';
import { AppError } from '../../errors';
/** Call after the contract lock, before starting goods money or dispatch. */
export async function assertNoFeeRefundHold(
  client: Pick<PoolClient, 'query'>,
  contractId: string,
): Promise<void> {
  const hold = await client.query(
    `SELECT r.id FROM fee_refund_requests r JOIN platform_fee_invoices f ON f.id=r.fee_id WHERE f.contract_id=$1 AND r.status IN('requested','sent','confirmed') LIMIT 1`,
    [contractId],
  );
  if (hold.rows.length)
    throw new AppError(
      'Platform fee refund recovery holds dispatch and new goods payment or security commitments. Resolve the refund or cancel the trade. Existing safety and arrival actions remain available.',
      409,
      'FEE_REFUND_HOLD',
    );
}
