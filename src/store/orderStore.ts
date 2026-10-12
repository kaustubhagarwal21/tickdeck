import { create } from 'zustand';
import { applyFill, isWorking, matchOrder, validateOrder } from '@tickdeck/core';
import type { Fill, Order, OrderRequest, Position, Tick } from '@tickdeck/core';
import { useMarketStore } from './marketStore';

/**
 * Paper trading: orders and positions, filled against the live trades. The
 * rules (validation, matching, position maths) are pure functions in
 * @tickdeck/core (packages/core/src/orders); this store keeps the state and
 * calls them.
 */
export interface OrderState {
  /** Every order placed this session, newest first. */
  orders: Order[];
  /** Open positions by symbol. A symbol is removed when its position goes flat. */
  positions: Record<string, Position>;
  placeOrder: (req: OrderRequest) => { ok: true; order: Order } | { ok: false; error: string };
  cancelOrder: (id: string) => void;
  /** Called for every incoming trade so that resting orders can fill. */
  onTick: (tick: Tick) => void;
}

/** The positions after a fill: updates that symbol, or removes it when flat. */
function withFill(positions: Record<string, Position>, fill: Fill): Record<string, Position> {
  const next = { ...positions };
  const position = applyFill(positions[fill.symbol], fill);
  if (position) next[fill.symbol] = position;
  else delete next[fill.symbol];
  return next;
}

export const useOrderStore = create<OrderState>()((set, get) => {
  let nextId = 1;

  return {
    orders: [],
    positions: {},

    placeOrder: (req) => {
      // Validation needs the latest trade price, which the market store holds.
      const lastPrice: number | undefined = useMarketStore.getState().quotes[req.symbol]?.last;
      const error = validateOrder(req, lastPrice);
      if (error) return { ok: false, error };

      const order: Order = { id: `ORD-${nextId++}`, req, status: 'OPEN', createdAt: Date.now() };
      set((s) => ({ orders: [order, ...s.orders] }));
      return { ok: true, order };
    },

    cancelOrder: (id) => {
      const order = get().orders.find((o) => o.id === id);
      if (!order || !isWorking(order)) return; // unknown, or already filled or cancelled
      set((s) => ({
        orders: s.orders.map((o): Order => (o.id === id ? { ...o, status: 'CANCELLED' } : o)),
      }));
    },

    onTick: (tick) => {
      const { orders, positions } = get();
      // This runs for every trade, hundreds of times a second. Most trades touch
      // no order, so return early, and call set() only when an order changes.
      if (!orders.some((o) => o.req.symbol === tick.symbol && isWorking(o))) return;

      let nextPositions = positions;
      let changed = false;
      const nextOrders = orders.map((order) => {
        const updated = matchOrder(order, tick);
        if (updated === order) return order;
        changed = true;
        if (updated.status === 'FILLED') {
          const { symbol, side, qty } = updated.req;
          nextPositions = withFill(nextPositions, { symbol, side, qty, price: updated.fillPrice ?? tick.price });
        }
        return updated;
      });

      if (changed) set({ orders: nextOrders, positions: nextPositions });
    },
  };
});
