export const money = (amount: unknown, currency = 'EUR', minorUnits = currency === 'JPY' ? 0 : 2) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(Number(amount || 0));
export const pretty = (value: string) =>
  String(value || '')
    .split('_')
    .join(' ');
