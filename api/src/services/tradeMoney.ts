import { ValidationError, ConflictError } from '../errors';

/** Initial settlement policy: four two-decimal currencies; no implicit FX. */
export const tradeCurrencies = ['EUR', 'USD', 'GHS', 'GBP'] as const;
export function requireTradeCurrency(currency: string): string {
  if (!(tradeCurrencies as readonly string[]).includes(currency))
    throw new ValidationError(
      'Supported trade currencies are EUR, USD, GHS and GBP. No currency conversion is performed.',
    );
  return currency;
}
export function requireSameCurrency(left: string, right: string): void {
  if (left !== right)
    throw new ConflictError(
      'Currency differs from the listing or contract. Create a matching-currency offer; no automatic conversion is available.',
    );
}
const power = (scale: number) => 10n ** BigInt(scale);
/** Decimal inputs, never intermediate floating-point arithmetic. */
export function decimalUnits(value: string | number, scale: number): bigint {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text))
    throw new ValidationError('Amount must be a non-negative plain decimal');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale)))
    throw new ValidationError(`Amount supports at most ${scale} decimal places`);
  return BigInt(whole) * power(scale) + BigInt(fraction.slice(0, scale).padEnd(scale, '0') || '0');
}
export function decimalText(units: bigint, scale = 2): string {
  return `${units / power(scale)}.${String(units % power(scale)).padStart(scale, '0')}`;
}
/** Non-negative half-up rounding, consistent with PostgreSQL NUMERIC ROUND. */
export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new ValidationError('Invalid money ratio');
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function tradeTotal(quantity: string | number, price: string | number): string {
  const cents = roundRatio(decimalUnits(quantity, 3) * decimalUnits(price, 4), 100000n);
  // NUMERIC(14,2), including its twelve integer digits.
  if (cents <= 0n || cents > 99999999999999n)
    throw new ValidationError(
      'Trade value must be at least 0.01 and fit the supported monetary range',
    );
  return decimalText(cents);
}
export function exactInstallmentAmounts(
  total: string | number,
  percentage: number,
): { total: string; deposit: string; balance: string } {
  const cents = decimalUnits(total, 2);
  const hundredths = decimalUnits(percentage, 2);
  if (hundredths > 10000n) throw new ValidationError('Deposit percentage cannot exceed 100');
  const deposit = roundRatio(cents * hundredths, 10000n);
  return {
    total: decimalText(cents),
    deposit: decimalText(deposit),
    balance: decimalText(cents - deposit),
  };
}
