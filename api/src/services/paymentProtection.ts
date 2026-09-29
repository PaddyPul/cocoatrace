export type PaymentPlan = 'pay_before_dispatch' | 'deposit_balance' | 'bank_secured' | 'documentary_collection' | 'pay_after_delivery';

export interface InstallmentDefinition {
  installmentType: 'deposit' | 'balance' | 'full';
  sequenceNumber: number;
  amountDue: number;
  dueTrigger: 'terms_agreed' | 'documents_presented' | 'delivery';
  status: 'due' | 'awaiting_trigger';
}

export function money(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function buildInstallments(plan: PaymentPlan, total: number, depositPercentage = 20): InstallmentDefinition[] {
  const amount = money(total);
  if (plan === 'deposit_balance') {
    const deposit = money(amount * depositPercentage / 100);
    return [
      { installmentType: 'deposit', sequenceNumber: 1, amountDue: deposit, dueTrigger: 'terms_agreed', status: 'due' },
      { installmentType: 'balance', sequenceNumber: 2, amountDue: money(amount - deposit), dueTrigger: 'documents_presented', status: 'awaiting_trigger' },
    ];
  }
  if (plan === 'pay_before_dispatch') return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'terms_agreed', status: 'due' }];
  if (plan === 'pay_after_delivery') return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'delivery', status: 'awaiting_trigger' }];
  return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'documents_presented', status: 'awaiting_trigger' }];
}

export function requiredBeforeDispatch(plan: PaymentPlan, total: number, depositPercentage = 20): number {
  if (plan === 'pay_before_dispatch') return money(total);
  if (plan === 'deposit_balance') return money(total * depositPercentage / 100);
  return 0;
}

export function dispatchDecision(input: { plan: PaymentPlan; termsStatus: string; amountConfirmed: number; dispatchRequiredAmount: number; securityStatus: string }): { allowed: boolean; reason?: string } {
  if (input.termsStatus !== 'agreed') return { allowed: false, reason: 'The buyer must confirm the payment terms before dispatch.' };
  if (input.plan === 'bank_secured' && input.securityStatus !== 'verified') return { allowed: false, reason: 'The bank or payment security must be verified before dispatch.' };
  if (input.amountConfirmed + 0.005 < input.dispatchRequiredAmount) return { allowed: false, reason: `Confirmed payment is below the dispatch requirement (${money(input.dispatchRequiredAmount).toFixed(2)} required).` };
  return { allowed: true };
}
