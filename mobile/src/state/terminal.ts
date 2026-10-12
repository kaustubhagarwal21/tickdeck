import { applyFill, isWorking, matchOrder, validateOrder } from '@tickdeck/core';
import type { Fill, Order, OrderRequest, Position, Quote, Tick } from '@tickdeck/core';

/**
 * All state of the mobile terminal: quotes, orders and positions, changed
 * only by the pure reducer below. The trading rules themselves (validation,
 * matching, position maths) come from @tickdeck/core, the same functions the
 * web app's stores call.
 */
export interface TerminalState {
  /** Latest quote per symbol. A symbol appears after its first trade. */
  quotes: Record<string, Quote>;
  /** Every order placed this session, newest first. */
  orders: Order[];
  /** Open positions by symbol. A symbol is removed when its position goes flat. */
  positions: Record<string, Position>;
  /** Number used for the next order id (ORD-1, ORD-2, ...). */
  nextOrderId: number;
}

export type TerminalAction =
  /** One batch of trades from the feed (about 100 ms worth), oldest first. */
  | { type: 'ticks'; ticks: Tick[] }
  /** Place an order. `now` is passed in so the reducer stays pure. */
  | { type: 'place'; req: OrderRequest; now: number }
  | { type: 'cancel'; id: string };

export const initialTerminalState: TerminalState = {
  quotes: {},
  orders: [],
  positions: {},
  nextOrderId: 1,
};

/** A symbol's quote after one more trade. Mirrors the web market store. */
export function nextQuote(prev: Quote | undefined, tick: Tick): Quote {
  // The first trade seen is the reference price that change is measured from.
  const open = prev?.open ?? tick.price;
  const change = tick.price - open;
  let dir: Quote['dir'] = 0;
  if (prev && tick.price > prev.last) dir = 1;
  if (prev && tick.price < prev.last) dir = -1;
  return {
    symbol: tick.symbol,
    last: tick.price,
    open,
    change,
    changePct: open === 0 ? 0 : (change / open) * 100,
    ts: tick.ts,
    dir,
  };
}

/** The positions after a fill: updates that symbol, or removes it when flat. */
function withFill(positions: Record<string, Position>, fill: Fill): Record<string, Position> {
  const next = { ...positions };
  const position = applyFill(positions[fill.symbol], fill);
  if (position) next[fill.symbol] = position;
  else delete next[fill.symbol];
  return next;
}

export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'ticks': {
      if (action.ticks.length === 0) return state;
      const quotes = { ...state.quotes };
      let orders = state.orders;
      let positions = state.positions;

      // Trades are applied one by one, in order, so an order fills at the
      // first trade that reaches its price, not at the end of the batch.
      for (const tick of action.ticks) {
        quotes[tick.symbol] = nextQuote(quotes[tick.symbol], tick);
        if (!orders.some((o) => o.req.symbol === tick.symbol && isWorking(o))) continue;

        orders = orders.map((order) => {
          // The batcher delivers trades up to 100 ms late, so skip trades that
          // happened before the order was placed.
          if (tick.ts < order.createdAt) return order;
          const updated = matchOrder(order, tick); // the shared matching rules
          if (updated !== order && updated.status === 'FILLED') {
            const { symbol, side, qty } = updated.req;
            positions = withFill(positions, { symbol, side, qty, price: updated.fillPrice ?? tick.price });
          }
          return updated;
        });
      }
      return { ...state, quotes, orders, positions };
    }

    case 'place': {
      const { req, now } = action;
      const id = `ORD-${state.nextOrderId}`;
      // The ticket validates while the user types; this is the final check
      // with the latest price. An invalid order is kept as REJECTED with the reason.
      const error = validateOrder(req, state.quotes[req.symbol]?.last);
      const order: Order = error
        ? { id, req, status: 'REJECTED', createdAt: now, reason: error }
        : { id, req, status: 'OPEN', createdAt: now };
      return { ...state, orders: [order, ...state.orders], nextOrderId: state.nextOrderId + 1 };
    }

    case 'cancel': {
      const target = state.orders.find((o) => o.id === action.id);
      if (!target || !isWorking(target)) return state; // unknown, or already done
      return {
        ...state,
        orders: state.orders.map((o): Order => (o.id === action.id ? { ...o, status: 'CANCELLED' } : o)),
      };
    }
  }
}
