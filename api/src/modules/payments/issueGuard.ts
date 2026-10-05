import type { PoolClient } from 'pg';
import { ConflictError } from '../../errors';
export async function assertNoActivePaymentIssue(
  client: PoolClient,
  paymentRequestId: string,
): Promise<void> {
  const row = (
    await client.query(
      "SELECT id FROM payment_issues WHERE payment_request_id=$1 AND status<>'resolved' LIMIT 1",
      [paymentRequestId],
    )
  ).rows[0];
  if (row)
    throw new ConflictError(
      'Resolve the active payment issue before changing this payment workflow',
    );
}
