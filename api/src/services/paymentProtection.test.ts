import { describe, expect, it } from 'vitest';
import { buildInstallments, dispatchDecision, requiredBeforeDispatch } from './paymentProtection';

describe('payment protection', () => {
  it('splits a deposit plan without losing cents', () => {
    const parts = buildInstallments('deposit_balance', 1234.57, 20);
    expect(parts.map((x) => x.amountDue)).toEqual([246.91, 987.66]);
  });
  it('requires full confirmation for pay-before-dispatch', () => {
    expect(requiredBeforeDispatch('pay_before_dispatch', 5000)).toBe(5000);
    expect(dispatchDecision({ plan:'pay_before_dispatch',termsStatus:'agreed',amountConfirmed:4999,dispatchRequiredAmount:5000,securityStatus:'not_required' }).allowed).toBe(false);
  });
  it('allows a confirmed deposit', () => expect(dispatchDecision({ plan:'deposit_balance',termsStatus:'agreed',amountConfirmed:1000,dispatchRequiredAmount:1000,securityStatus:'not_required' }).allowed).toBe(true));
  it('requires verified bank security', () => expect(dispatchDecision({ plan:'bank_secured',termsStatus:'agreed',amountConfirmed:0,dispatchRequiredAmount:0,securityStatus:'submitted' }).allowed).toBe(false));
  it('blocks unconfirmed terms', () => expect(dispatchDecision({ plan:'pay_after_delivery',termsStatus:'proposed',amountConfirmed:0,dispatchRequiredAmount:0,securityStatus:'not_required' }).allowed).toBe(false));
});
