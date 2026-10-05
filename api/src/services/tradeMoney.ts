import { ValidationError, ConflictError } from '../errors';

/** Initial settlement policy: four two-decimal currencies and whole-yen JPY; no implicit FX. */
export const tradeCurrencies = ['EUR', 'USD', 'GHS', 'GBP', 'JPY'] as const;
export function requireTradeCurrency(currency: string): string {
  if (!(tradeCurrencies as readonly string[]).includes(currency))
    throw new ValidationError(
      'Supported trade currencies are EUR, USD, GHS, GBP and JPY. No currency conversion is performed.',
    );
  return currency;
}
export function requireSameCurrency(left: string, right: string): void {
  if (left !== right)
    throw new ConflictError(
      'Currency differs from the listing or contract. Create a matching-currency offer; no automatic conversion is available.',
    );
}
export function tradeMinorUnits(currency: string): number {
  requireTradeCurrency(currency);
  return currency === 'JPY' ? 0 : 2;
}
export function requireSamePrecision(left = 2, right = 2): void {
  if (left !== right)
    throw new ConflictError('Payment precision differs from the contract snapshot');
}
function requireScale(scale: number): void {
  if (scale !== 0 && scale !== 2) throw new ValidationError('Unsupported settlement precision');
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
  if (scale === 0) return String(units);
  return `${units / power(scale)}.${String(units % power(scale)).padStart(scale, '0')}`;
}
/** Non-negative half-up rounding, consistent with PostgreSQL NUMERIC ROUND. */
export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new ValidationError('Invalid money ratio');
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function tradeTotal(quantity: string | number, price: string | number, scale = 2): string {
  requireScale(scale);
  const cents = roundRatio(decimalUnits(quantity, 3) * decimalUnits(price, 4), power(7 - scale));
  // NUMERIC(14,2), including its twelve integer digits.
  if (cents <= 0n || cents * power(2 - scale) > 99999999999999n)
    throw new ValidationError(
      'Trade value must be at least one currency minor unit and fit the supported monetary range',
    );
  return decimalText(cents, scale);
}
export function exactInstallmentAmounts(
  total: string | number,
  percentage: number,
  scale = 2,
): { total: string; deposit: string; balance: string } {
  requireScale(scale);
  const cents = decimalUnits(total, scale);
  const hundredths = decimalUnits(percentage, 2);
  if (hundredths > 10000n) throw new ValidationError('Deposit percentage cannot exceed 100');
  const deposit = roundRatio(cents * hundredths, 10000n);
  return {
    total: decimalText(cents, scale),
    deposit: decimalText(deposit, scale),
    balance: decimalText(cents - deposit, scale),
  };
}
