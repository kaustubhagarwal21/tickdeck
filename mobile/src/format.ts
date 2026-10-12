/** Number formatting for prices and changes (two decimals, as NSE quotes). */

/** 1450.3 -> "1450.30". */
export function formatPrice(value: number): string {
  return value.toFixed(2);
}

/** Adds an explicit sign: 1.5 -> "+1.50", -1.5 -> "-1.50", 0 -> "0.00". */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
