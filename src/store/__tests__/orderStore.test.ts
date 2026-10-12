import type { OrderRequest, Side, Tick } from '@/lib/types';
import { useMarketStore } from '../marketStore';
import { useOrderStore } from '../orderStore';

const trade = (price: number, symbol = 'TCS'): Tick => ({ symbol, price, qty: 1, ts: 5 });
const orders = () => useOrderStore.getState();
const onTick = (price: number, symbol = 'TCS') => orders().onTick(trade(price, symbol));

/** Places an order that must be valid, and returns it. */
function place(req: OrderRequest) {
  const result = orders().placeOrder(req);
  if (!result.ok) throw new Error(`Order was rejected: ${result.error}`);
  return result.order;
}
const statusOf = (id: string) => orders().orders.find((o) => o.id === id)?.status;
const marketOrder = (side: Side, qty: number): OrderRequest => ({ type: 'MARKET', side, symbol: 'TCS', qty });

beforeEach(() => {
  useOrderStore.setState({ orders: [], positions: {} });
  // TCS last traded at 100, which validation of market and stop orders needs.
  useMarketStore.getState().reset('simulated', ['TCS', 'INFY']);
  useMarketStore.getState().applyBatch([{ kind: 'tick', tick: trade(100) }]);
});

describe('placeOrder', () => {
  it('rejects an invalid order with a message and stores nothing', () => {
    const result = orders().placeOrder({ type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 0, price: 99 });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/quantity/i) });
    expect(orders().orders).toEqual([]);
  });

  it('validates against the latest trade price from the market store', () => {
    // A sell stop must trigger below the last price (100).
    const result = orders().placeOrder({ type: 'SL', side: 'SELL', symbol: 'TCS', qty: 1, trigger: 101, price: 100 });
    expect(result.ok).toBe(false);

    // INFY has not traded yet, so a market order cannot be priced.
    expect(orders().placeOrder({ type: 'MARKET', side: 'BUY', symbol: 'INFY', qty: 1 }).ok).toBe(false);
  });

  it('accepts a valid order as OPEN and lists the newest first', () => {
    const first = place({ type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 90 });
    const second = place({ type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 1, price: 110 });

    expect(first).toMatchObject({ status: 'OPEN', req: { price: 90 } });
    expect(first.id).not.toBe(second.id);
    expect(orders().orders.map((o) => o.id)).toEqual([second.id, first.id]);
  });
});

describe('MARKET orders', () => {
  it.each<[Side, number]>([
    ['BUY', 5],
    ['SELL', -5],
  ])('%s fills at the next trade in its symbol', (side, positionQty) => {
    const order = place(marketOrder(side, 5));

    onTick(50, 'INFY'); // another symbol: no effect
    expect(statusOf(order.id)).toBe('OPEN');

    onTick(101.5);
    expect(orders().orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 101.5, filledAt: 5 });
    expect(orders().positions.TCS).toEqual({ symbol: 'TCS', qty: positionQty, avgPrice: 101.5 });
  });
});

describe('LIMIT orders', () => {
  it('BUY waits until the price falls to the limit', () => {
    const order = place({ type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 2, price: 99 });

    onTick(99.5);
    expect(statusOf(order.id)).toBe('OPEN');
    onTick(98.9);
    expect(orders().orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 98.9 });
    expect(orders().positions.TCS.qty).toBe(2);
  });

  it('SELL waits until the price rises to the limit', () => {
    const order = place({ type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 2, price: 101 });

    onTick(100.5);
    expect(statusOf(order.id)).toBe('OPEN');
    onTick(101);
    expect(orders().orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 101 });
    expect(orders().positions.TCS.qty).toBe(-2);
  });
});

describe('SL orders', () => {
  it('SELL triggers when the price falls to the trigger, then fills like a limit', () => {
    // Protects a long: once TCS falls to 95, sell at 94 or better.
    const order = place({ type: 'SL', side: 'SELL', symbol: 'TCS', qty: 3, trigger: 95, price: 94 });

    onTick(96);
    expect(statusOf(order.id)).toBe('OPEN');
    onTick(93); // gaps through the trigger and below the limit
    expect(statusOf(order.id)).toBe('TRIGGERED');
    onTick(94.5);
    expect(orders().orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 94.5 });
    expect(orders().positions.TCS.qty).toBe(-3);
  });

  it('BUY triggers when the price rises to the trigger, then fills like a limit', () => {
    const order = place({ type: 'SL', side: 'BUY', symbol: 'TCS', qty: 3, trigger: 105, price: 106 });

    onTick(104);
    expect(statusOf(order.id)).toBe('OPEN');
    onTick(107); // above the 106 limit: triggered but not filled
    expect(statusOf(order.id)).toBe('TRIGGERED');
    onTick(105.5);
    expect(orders().orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 105.5 });
    expect(orders().positions.TCS.qty).toBe(3);
  });

  it('triggers and fills on the same trade when the price allows', () => {
    const order = place({ type: 'SL', side: 'SELL', symbol: 'TCS', qty: 1, trigger: 95, price: 94 });
    onTick(94.8);
    expect(statusOf(order.id)).toBe('FILLED');
  });
});

describe('cancelOrder', () => {
  it('cancels a working order so it never fills', () => {
    const order = place({ type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 99 });
    orders().cancelOrder(order.id);
    onTick(90);

    expect(statusOf(order.id)).toBe('CANCELLED');
    expect(orders().positions).toEqual({});
  });

  it('cancels a triggered SL order', () => {
    const order = place({ type: 'SL', side: 'BUY', symbol: 'TCS', qty: 1, trigger: 105, price: 106 });
    onTick(107);
    orders().cancelOrder(order.id);
    expect(statusOf(order.id)).toBe('CANCELLED');
  });

  it('leaves filled orders and unknown ids alone', () => {
    const order = place(marketOrder('BUY', 1));
    onTick(100);
    const before = orders().orders;

    orders().cancelOrder(order.id);
    orders().cancelOrder('no-such-order');

    expect(orders().orders).toBe(before);
    expect(statusOf(order.id)).toBe('FILLED');
  });
});

describe('onTick', () => {
  it('does not update the store when no order is affected', () => {
    place({ type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 50 });
    const listener = jest.fn();
    const unsubscribe = useOrderStore.subscribe(listener);

    onTick(100);
    onTick(100, 'INFY');

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('fills several orders on one trade in a single update', () => {
    place(marketOrder('BUY', 1));
    place(marketOrder('BUY', 2));
    const listener = jest.fn();
    const unsubscribe = useOrderStore.subscribe(listener);

    onTick(100);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(orders().positions.TCS.qty).toBe(3);
    unsubscribe();
  });
});

describe('positions', () => {
  it('averages in, keeps the average when reducing, and removes a flat position', () => {
    place(marketOrder('BUY', 10));
    onTick(100);
    place(marketOrder('BUY', 10));
    onTick(110);
    expect(orders().positions.TCS).toEqual({ symbol: 'TCS', qty: 20, avgPrice: 105 });

    place(marketOrder('SELL', 5));
    onTick(120);
    expect(orders().positions.TCS).toEqual({ symbol: 'TCS', qty: 15, avgPrice: 105 });

    place(marketOrder('SELL', 15));
    onTick(90);
    expect(orders().positions.TCS).toBeUndefined();
  });

  it('reverses through zero: long 10, sell 15 leaves a short of 5 at the fill price', () => {
    place(marketOrder('BUY', 10));
    onTick(100);
    place(marketOrder('SELL', 15));
    onTick(110);

    expect(orders().positions.TCS).toEqual({ symbol: 'TCS', qty: -5, avgPrice: 110 });
  });
});
