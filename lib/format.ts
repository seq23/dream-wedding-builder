export function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}
export function range(low: number, high: number, currency = 'USD') {
  return `${money(low, currency)}–${money(high, currency)}`;
}
