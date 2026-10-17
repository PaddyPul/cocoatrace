import { ConflictError, ValidationError } from '../../errors';
import type { PaymentPlan } from '../../services/paymentProtection';

export type AgreedPaymentState =
  | 'payment_due'
  | 'awaiting_security'
  | 'awaiting_documents'
  | 'awaiting_delivery';

export function paymentStateAfterAgreement(plan: PaymentPlan): AgreedPaymentState {
  const states: Record<PaymentPlan, AgreedPaymentState> = {
    pay_before_dispatch: 'payment_due',
    deposit_balance: 'payment_due',
    bank_secured: 'awaiting_security',
    documentary_collection: 'awaiting_documents',
    pay_after_delivery: 'awaiting_delivery',
  };
  return states[plan];
}

/** Creation is not a retry of an existing workflow: duplicate requests remain conflicts. */
export function assertRequestCanBeCreated(status: string, existing: boolean): void {
  if (['settled', 'cancelled'].includes(status))
    throw new ConflictError('Closed contracts cannot request a new payment');
  if (existing) throw new ConflictError('A payment workflow already exists for this contract');
}

/** The total is rounded in PostgreSQL at the contract's stored currency precision. */
export function assertRequestMoney(
  total: string,
  currency: string,
  input: { amountTotal: number; currency: string },
): void {
  if (Number(total) !== input.amountTotal || currency !== input.currency)
    throw new ValidationError('The payment amount and currency must match the contract');
}
