import type { PoolClient } from 'pg';

export type PaymentDueTrigger = 'terms_agreed' | 'documents_presented' | 'delivery';

/** Call under the contract/payment lock and in the transaction recording the trigger.
 * Replays never extend an existing deadline or revive a paid/submitted installment.
 * Credit days belong only to delivery credit; deposits and presented documents are due immediately.
 */
export async function activatePaymentInstallments(
  client: PoolClient,
  paymentId: string,
  trigger: PaymentDueTrigger,
  options: { triggeredAt?: Date | string | null; creditDays?: number } = {},
): Promise<void> {
  const creditDays = trigger === 'delivery' ? (options.creditDays ?? 0) : 0;
  if (!Number.isInteger(creditDays) || creditDays < 0 || creditDays > 365) {
    throw new RangeError('Delivery credit days must be an integer between 0 and 365');
  }
  await client.query(
    `UPDATE payment_installments
    SET status='due',due_at=COALESCE(due_at,COALESCE($3::timestamptz,NOW())+make_interval(days=>$4)),updated_at=NOW()
    WHERE payment_request_id=$1 AND due_trigger=$2
      AND (status='awaiting_trigger' OR (status='due' AND due_at IS NULL))`,
    [paymentId, trigger, options.triggeredAt ?? null, creditDays],
  );
}
