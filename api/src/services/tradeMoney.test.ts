import { describe, expect, it } from 'vitest';
import {
  decimalUnits,
  tradeTotal,
  exactInstallmentAmounts,
  requireSameCurrency,
  requireTradeCurrency,
} from './tradeMoney';
import { buildInstallments, requiredBeforeDispatch, dispatchDecision } from './paymentProtection';
describe('exact two-decimal trade money', () => {
  it.each(['EUR', 'USD', 'GHS', 'GBP'])('allows %s without conversion', (currency) =>
    expect(requireTradeCurrency(currency)).toBe(currency),
  );
  it.each(['JPY', 'XXX', 'eur', ' EUR', 'KWD'])('rejects unsupported %s explicitly', (currency) =>
    expect(() => requireTradeCurrency(currency)).toThrow(),
  );
  it('rejects a mismatching quote', () =>
    expect(() => requireSameCurrency('GHS', 'EUR')).toThrow());
  it.each([
    ['0.125', '4.0400', '0.51'],
    ['0.001', '5', '0.01'],
    ['3.333', '0.3333', '1.11'],
    ['1', '1.005', '1.01'],
    ['1000000', '999999.9999', '999999999900.00'],
  ])('rounds %s * %s once, half up', (q, p, total) => expect(tradeTotal(q, p)).toBe(total));
  it.each([
    ['0.001', '0.0001'],
    ['1000000', '1000000'],
    ['1', '-1'],
    ['1.0001', '1'],
    ['1', '1.00001'],
  ])('rejects zero, overflow or invalid precision %s/%s', (q, p) =>
    expect(() => tradeTotal(q, p)).toThrow(),
  );
  it('retains all cents at the monetary limit', () =>
    expect(exactInstallmentAmounts('999999999999.99', 20)).toEqual({
      total: '999999999999.99',
      deposit: '200000000000.00',
      balance: '799999999999.99',
    }));
  it('preserves every cent across deposits and dispatch requirements', () => {
    for (let cents = 1; cents < 1000; cents++) {
      const total = (cents / 100).toFixed(2);
      for (const percentage of [1, 20, 33.33, 50, 99]) {
        const parts = buildInstallments('deposit_balance', total, percentage);
        expect(decimalUnits(parts[0].amountDue, 2) + decimalUnits(parts[1].amountDue, 2)).toBe(
          BigInt(cents),
        );
        expect(requiredBeforeDispatch('deposit_balance', total, percentage)).toBe(
          parts[0].amountDue,
        );
      }
    }
  });
  it('does not forgive a cent at the dispatch gate', () =>
    expect(
      dispatchDecision({
        plan: 'pay_before_dispatch',
        termsStatus: 'agreed',
        amountConfirmed: '1.00',
        dispatchRequiredAmount: '1.01',
        securityStatus: 'not_required',
      }).allowed,
    ).toBe(false));
});
