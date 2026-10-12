import type { BookLevel, BookSnapshot } from '@tickdeck/core';

/** One price level as the order book shows it. */
export interface LadderRow {
  price: number;
  qty: number;
  /** Quantity at this level plus every better level on the same side. */
  total: number;
}

/** Everything the order book panel draws, worked out from one snapshot. */
export interface Ladder {
  /** Best (lowest) ask first. */
  asks: LadderRow[];
  /** Best (highest) bid first. */
  bids: LadderRow[];
  /** Largest `total` on either side. Depth bars are drawn as total / maxTotal. */
  maxTotal: number;
  /** Best ask minus best bid, or null when a side is empty. */
  spread: number | null;
  /** The spread as a percentage of the mid price. */
  spreadPct: number | null;
}

/**
 * Turns a book snapshot into the rows the order book panel draws: the best
 * `depth` levels per side, each with its running total.
 *
 * The feed already sends sorted levels. Sorting a copy anyway costs next to
 * nothing for a few dozen levels and protects the display from a bad snapshot.
 * It is a pure function, so it is tested without rendering anything.
 */
export function buildLadder(book: BookSnapshot, depth: number): Ladder {
  const bids = withTotals([...book.bids].sort((a, b) => b.price - a.price).slice(0, depth));
  const asks = withTotals([...book.asks].sort((a, b) => a.price - b.price).slice(0, depth));

  // The last row on each side has the biggest running total.
  const maxTotal = Math.max(bids.at(-1)?.total ?? 0, asks.at(-1)?.total ?? 0);

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  if (bestBid === undefined || bestAsk === undefined) {
    return { asks, bids, maxTotal, spread: null, spreadPct: null };
  }

  const spread = bestAsk - bestBid;
  const mid = (bestAsk + bestBid) / 2;
  return { asks, bids, maxTotal, spread, spreadPct: (spread / mid) * 100 };
}

function withTotals(levels: BookLevel[]): LadderRow[] {
  let total = 0;
  return levels.map(({ price, qty }) => {
    total += qty;
    return { price, qty, total };
  });
}
