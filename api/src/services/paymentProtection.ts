import { ValidationError } from '../errors';
import { decimalUnits, exactInstallmentAmounts } from './tradeMoney';
export type PaymentPlan = 'pay_before_dispatch' | 'deposit_balance' | 'bank_secured' | 'documentary_collection' | 'pay_after_delivery';

export interface InstallmentDefinition {
  installmentType: 'deposit' | 'balance' | 'full';
  sequenceNumber: number;
  amountDue: number;
  dueTrigger: 'terms_agreed' | 'documents_presented' | 'delivery';
  status: 'due' | 'awaiting_trigger';
}


export function buildInstallments(plan: PaymentPlan, total: string | number, depositPercentage = 20, minorUnits = 2): InstallmentDefinition[] {
  const exact = exactInstallmentAmounts(total, depositPercentage, minorUnits);
  const amount = Number(exact.total);
  if (plan === 'deposit_balance') {
    const deposit = Number(exact.deposit);
    if (minorUnits === 0 && (deposit === 0 || Number(exact.balance) === 0)) throw new ValidationError('This deposit split rounds to a zero installment. Choose full payment or increase the trade value.');
    return [
      { installmentType: 'deposit', sequenceNumber: 1, amountDue: deposit, dueTrigger: 'terms_agreed', status: 'due' },
      { installmentType: 'balance', sequenceNumber: 2, amountDue: Number(exact.balance), dueTrigger: 'documents_presented', status: 'awaiting_trigger' },
    ];
  }
  if (plan === 'pay_before_dispatch') return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'terms_agreed', status: 'due' }];
  if (plan === 'pay_after_delivery') return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'delivery', status: 'awaiting_trigger' }];
  return [{ installmentType: 'full', sequenceNumber: 1, amountDue: amount, dueTrigger: 'documents_presented', status: 'awaiting_trigger' }];
}

export function requiredBeforeDispatch(plan: PaymentPlan, total: string | number, depositPercentage = 20, minorUnits = 2): number {
  if (plan === 'pay_before_dispatch') return Number(exactInstallmentAmounts(total, depositPercentage, minorUnits).total);
  if (plan === 'deposit_balance') return Number(exactInstallmentAmounts(total, depositPercentage, minorUnits).deposit);
  return 0;
}

export function dispatchDecision(input: { plan: PaymentPlan; termsStatus: string; amountConfirmed: string | number; dispatchRequiredAmount: string | number; securityStatus: string; currencyMinorUnits?: number }): { allowed: boolean; reason?: string } {
  if (input.termsStatus !== 'agreed') return { allowed: false, reason: 'The buyer must confirm the payment terms before dispatch.' };
  if (input.plan === 'bank_secured' && input.securityStatus !== 'verified') return { allowed: false, reason: 'The bank or payment security must be verified before dispatch.' };
  if (decimalUnits(input.amountConfirmed, input.currencyMinorUnits ?? 2) < decimalUnits(input.dispatchRequiredAmount, input.currencyMinorUnits ?? 2)) return { allowed: false, reason: `Confirmed payment is below the dispatch requirement (${Number(input.dispatchRequiredAmount).toFixed(input.currencyMinorUnits ?? 2)} required).` };
  return { allowed: true };
}
