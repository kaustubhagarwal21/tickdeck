import type { OrderRequest } from '../types';

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * Checks an order before it is placed. Returns a message for the user, or
 * null when the order is valid. `lastPrice` is the latest trade price for the
 * order's symbol, if a trade has arrived yet.
 *
 * It is a pure function (it reads only its arguments), so the order ticket can
 * also call it while the user types, to show problems before they submit.
 */
export function validateOrder(req: OrderRequest, lastPrice?: number): string | null {
  if (!req.symbol) return 'Choose a symbol.';
  if (!Number.isInteger(req.qty) || req.qty <= 0) {
    return 'Quantity must be a whole number greater than 0.';
  }

  switch (req.type) {
    case 'MARKET':
      // A market order fills at the next trade, so the symbol must be trading.
      if (lastPrice === undefined) return `No price for ${req.symbol} yet. Wait for the first trade.`;
      return null;

    case 'LIMIT':
      if (!isPositive(req.price)) return 'Limit price must be greater than 0.';
      return null;

    case 'SL':
      if (!isPositive(req.trigger)) return 'Trigger price must be greater than 0.';
      if (!isPositive(req.price)) return 'Limit price must be greater than 0.';
      if (req.side === 'BUY') {
        // A buy stop waits for the price to RISE to the trigger, then buys at up to `price`.
        if (req.price < req.trigger) {
          return 'For a buy stop-loss, the limit price must be at or above the trigger price.';
        }
        if (lastPrice !== undefined && req.trigger <= lastPrice) {
          return `For a buy stop-loss, the trigger must be above the last price (${lastPrice}).`;
        }
      } else {
        // A sell stop waits for the price to FALL to the trigger, then sells at `price` or better.
        if (req.price > req.trigger) {
          return 'For a sell stop-loss, the limit price must be at or below the trigger price.';
        }
        if (lastPrice !== undefined && req.trigger >= lastPrice) {
          return `For a sell stop-loss, the trigger must be below the last price (${lastPrice}).`;
        }
      }
      return null;
  }
}
