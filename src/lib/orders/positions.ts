import type { Position, Side } from '@/lib/types';

/** One execution: what was traded, in which direction, how much and at what price. */
export interface Fill {
  symbol: string;
  side: Side;
  qty: number;
  price: number;
}

/**
 * Returns the position after a fill, or null when the position is now flat.
 * Quantities are signed: buys add, sells subtract, and below zero is a short.
 *
 *  - Opening or adding (same direction): the average price becomes the
 *    quantity-weighted average of the old position and the fill.
 *  - Reducing (opposite direction, not past zero): the average price stays the
 *    same; the closed part simply leaves the position.
 *  - Reversing through zero (for example long 10, then sell 15): the long
 *    closes, and the remaining 5 become a new short at the fill price.
 */
export function applyFill(position: Position | undefined, fill: Fill): Position | null {
  const held = position?.qty ?? 0;
  const avg = position?.avgPrice ?? 0;
  const delta = fill.side === 'BUY' ? fill.qty : -fill.qty;
  const qty = held + delta;

  if (qty === 0) return null; // closed completely

  // Opening or adding.
  if (held === 0 || Math.sign(held) === Math.sign(delta)) {
    const avgPrice = (Math.abs(held) * avg + fill.qty * fill.price) / Math.abs(qty);
    return { symbol: fill.symbol, qty, avgPrice };
  }

  // Reducing, still on the same side of zero.
  if (Math.sign(qty) === Math.sign(held)) {
    return { symbol: fill.symbol, qty, avgPrice: avg };
  }

  // Reversed through zero.
  return { symbol: fill.symbol, qty, avgPrice: fill.price };
}
