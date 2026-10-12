import type { OrderRequest, Side } from '@/lib/types';

/**
 * Number and text formatting shared by every panel.
 *
 * The simulated NSE stocks are priced in rupees and use Indian digit grouping
 * (1,23,456.70). The Binance pairs are priced in USDT and use international
 * grouping (123,456.70).
 */

/** Binance pairs end in USDT. Every other symbol is a simulated NSE stock priced in rupees. */
export function isCryptoSymbol(symbol: string): boolean {
  return symbol.endsWith('USDT');
}

// Creating an Intl.NumberFormat is far slower than using one, and prices are
// formatted for every visible row on every frame. So each formatter is built
// once, the first time a given locale and set of options is needed.
const formatters = new Map<string, Intl.NumberFormat>();

function cachedFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

function localeFor(symbol: string): string {
  return isCryptoSymbol(symbol) ? 'en-US' : 'en-IN';
}

/**
 * Decimal places for a price. NSE stocks move in paise, so they always get 2.
 * Cheap coins need more: DOGE trades around 0.2 USDT, where 2 decimals would
 * hide every price move.
 */
export function priceDecimals(symbol: string, price: number): number {
  if (!isCryptoSymbol(symbol) || price >= 100) return 2;
  return price >= 1 ? 4 : 5;
}

/** A price without a currency sign, e.g. "1,450.05" (stock) or "0.21345" (DOGE). */
export function formatPrice(symbol: string, price: number): string {
  const decimals = priceDecimals(symbol, price);
  return cachedFormatter(localeFor(symbol), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

/** A price as plain text for an input box: no grouping commas, e.g. "1450.05". */
export function priceInputValue(symbol: string, price: number): string {
  return price.toFixed(priceDecimals(symbol, price));
}

/**
 * Decimal places for a quantity, given the instrument's price. Stocks trade in
 * whole shares. Coins trade in fractions, and the dearer the coin the finer
 * the step: Binance sizes BTC in 0.00001s but DOGE in whole coins.
 */
export function qtyDecimals(symbol: string, price: number): number {
  if (!isCryptoSymbol(symbol)) return 0;
  if (price >= 1000) return 5;
  if (price >= 10) return 3;
  return price >= 1 ? 1 : 0;
}

/**
 * A quantity: whole shares for stocks, fractions for coins (0.00125 BTC).
 * Pass the price to get a fixed number of decimals, which keeps a column of
 * quantities, like the order book's, lined up on the decimal point.
 */
export function formatQty(symbol: string, qty: number, price?: number): string {
  if (price === undefined) {
    return cachedFormatter(localeFor(symbol), {
      maximumFractionDigits: isCryptoSymbol(symbol) ? 5 : 0,
    }).format(qty);
  }
  const decimals = qtyDecimals(symbol, price);
  return cachedFormatter(localeFor(symbol), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(qty);
}

/**
 * An amount of money with its currency: "₹14,500.50" or "14,500.50 USDT".
 * With `signed`, gains get a plus sign ("+₹250.00"), which suits P&L.
 */
export function formatMoney(symbol: string, amount: number, signed = false): string {
  const signDisplay = signed ? 'exceptZero' : 'auto';
  if (isCryptoSymbol(symbol)) {
    const digits = cachedFormatter('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay,
    }).format(amount);
    return `${digits} USDT`;
  }
  return cachedFormatter('en-IN', { style: 'currency', currency: 'INR', signDisplay }).format(amount);
}

/** Tailwind text colour for a signed number: green above zero, red below, grey at zero or unknown. */
export function signColor(value: number | undefined): string {
  if (value === undefined || value === 0 || Number.isNaN(value)) return 'text-muted';
  return value > 0 ? 'text-up' : 'text-down';
}

/** A percentage with an explicit sign: "+1.25%", "-0.40%", "0.00%". */
export function formatPercent(pct: number): string {
  const digits = cachedFormatter('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(pct);
  return `${digits}%`;
}

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** A timestamp in milliseconds as local 24-hour time, e.g. "14:05:09". */
export function formatTime(ms: number): string {
  return timeFormatter.format(ms);
}

const SIDE_WORD: Record<Side, string> = { BUY: 'Buy', SELL: 'Sell' };

/**
 * One-line summary of an order, used in toasts and button labels:
 *   "Buy 10 TCS at market"
 *   "Sell 5 TCS at limit 3,100.00"
 *   "Sell 5 TCS at limit 3,090.00, trigger 3,095.00"
 */
export function describeOrder(req: OrderRequest): string {
  const start = `${SIDE_WORD[req.side]} ${formatQty(req.symbol, req.qty)} ${req.symbol}`;
  // Each case sees only the fields of its own order type (discriminated union).
  switch (req.type) {
    case 'MARKET':
      return `${start} at market`;
    case 'LIMIT':
      return `${start} at limit ${formatPrice(req.symbol, req.price)}`;
    case 'SL':
      return `${start} at limit ${formatPrice(req.symbol, req.price)}, trigger ${formatPrice(req.symbol, req.trigger)}`;
  }
}
