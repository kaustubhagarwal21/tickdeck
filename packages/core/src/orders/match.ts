import type { Order, Side, Tick } from '../types';

/**
 * Pure order-matching rules for paper trading. The order store runs
 * matchOrder for its working orders on every trade. Nothing here touches the
 * store, so every rule can be tested on its own.
 *
 * Two simplifications, as in most paper-trading simulators:
 *  - An order fills at the trade price, which for a limit order is never worse
 *    than its limit.
 *  - A trade exactly at the limit (or trigger) price counts as reaching it.
 */

/** An order that can still fill: OPEN, or an SL order that has TRIGGERED. */
export function isWorking(order: Order): boolean {
  return order.status === 'OPEN' || order.status === 'TRIGGERED';
}

/** A buy limit fills at or below its limit price; a sell limit at or above it. */
function limitReached(side: Side, limit: number, price: number): boolean {
  return side === 'BUY' ? price <= limit : price >= limit;
}

/**
 * Does a trade at `price` trigger this SL order? A buy stop triggers when the
 * price rises to the trigger, a sell stop when it falls to it.
 */
export function shouldTrigger(order: Order, price: number): boolean {
  const { req } = order;
  if (req.type !== 'SL' || order.status !== 'OPEN') return false;
  return req.side === 'BUY' ? price >= req.trigger : price <= req.trigger;
}

/** Does a trade at `price` fill this order? */
export function shouldFill(order: Order, price: number): boolean {
  const { req } = order;
  switch (req.type) {
    case 'MARKET':
      return order.status === 'OPEN'; // fills at the first trade after it is placed
    case 'LIMIT':
      return order.status === 'OPEN' && limitReached(req.side, req.price, price);
    case 'SL':
      // Only once triggered; from then on it behaves like a limit order.
      return order.status === 'TRIGGERED' && limitReached(req.side, req.price, price);
  }
}

/**
 * Applies one trade to one order. Returns the updated order, or the very same
 * object when nothing changed, so the caller can detect changes with `!==`.
 * An SL order can trigger and fill on the same trade.
 */
export function matchOrder(order: Order, tick: Tick): Order {
  if (order.req.symbol !== tick.symbol || !isWorking(order)) return order;

  let next = order;
  if (shouldTrigger(next, tick.price)) {
    next = { ...next, status: 'TRIGGERED' };
  }
  if (shouldFill(next, tick.price)) {
    next = { ...next, status: 'FILLED', filledAt: tick.ts, fillPrice: tick.price };
  }
  return next;
}
