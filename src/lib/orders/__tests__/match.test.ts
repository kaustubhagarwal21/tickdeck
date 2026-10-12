import type { Order, OrderRequest, OrderStatus, Tick } from '@/lib/types';
import { isWorking, matchOrder, shouldFill, shouldTrigger } from '../match';

const order = (req: OrderRequest, status: OrderStatus = 'OPEN'): Order => ({
  id: 'ORD-1',
  req,
  status,
  createdAt: 0,
});
const trade = (price: number, symbol = 'TCS'): Tick => ({ symbol, price, qty: 1, ts: 99 });

const marketBuy: OrderRequest = { type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 1 };
const limitBuy: OrderRequest = { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 100 };
const limitSell: OrderRequest = { type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 1, price: 100 };
// A buy stop: triggers when the price rises to 105, then buys at 106 or less.
const stopBuy: OrderRequest = { type: 'SL', side: 'BUY', symbol: 'TCS', qty: 1, trigger: 105, price: 106 };
// A sell stop: triggers when the price falls to 95, then sells at 94 or more.
const stopSell: OrderRequest = { type: 'SL', side: 'SELL', symbol: 'TCS', qty: 1, trigger: 95, price: 94 };

describe('isWorking', () => {
  it.each<[OrderStatus, boolean]>([
    ['OPEN', true],
    ['TRIGGERED', true],
    ['FILLED', false],
    ['CANCELLED', false],
    ['REJECTED', false],
  ])('%s → %p', (status, expected) => {
    expect(isWorking(order(limitBuy, status))).toBe(expected);
  });
});

describe('shouldFill', () => {
  it('fills an open MARKET order at any price', () => {
    expect(shouldFill(order(marketBuy), 1)).toBe(true);
    expect(shouldFill(order(marketBuy), 1_000_000)).toBe(true);
    expect(shouldFill(order(marketBuy, 'FILLED'), 1)).toBe(false);
  });

  it('fills a BUY limit at or below its price', () => {
    expect(shouldFill(order(limitBuy), 100.05)).toBe(false);
    expect(shouldFill(order(limitBuy), 100)).toBe(true);
    expect(shouldFill(order(limitBuy), 99)).toBe(true);
  });

  it('fills a SELL limit at or above its price', () => {
    expect(shouldFill(order(limitSell), 99.95)).toBe(false);
    expect(shouldFill(order(limitSell), 100)).toBe(true);
    expect(shouldFill(order(limitSell), 101)).toBe(true);
  });

  it('never fills an SL order before it triggers', () => {
    expect(shouldFill(order(stopBuy), 105.5)).toBe(false);
    expect(shouldFill(order(stopSell), 94.5)).toBe(false);
  });

  it('fills a triggered SL order like a limit order', () => {
    expect(shouldFill(order(stopBuy, 'TRIGGERED'), 106.05)).toBe(false);
    expect(shouldFill(order(stopBuy, 'TRIGGERED'), 106)).toBe(true);
    expect(shouldFill(order(stopSell, 'TRIGGERED'), 93.95)).toBe(false);
    expect(shouldFill(order(stopSell, 'TRIGGERED'), 94)).toBe(true);
  });

  it('never fills a cancelled order', () => {
    expect(shouldFill(order(limitBuy, 'CANCELLED'), 50)).toBe(false);
  });
});

describe('shouldTrigger', () => {
  it('triggers a BUY stop when the price rises to the trigger', () => {
    expect(shouldTrigger(order(stopBuy), 104.95)).toBe(false);
    expect(shouldTrigger(order(stopBuy), 105)).toBe(true);
    expect(shouldTrigger(order(stopBuy), 110)).toBe(true);
  });

  it('triggers a SELL stop when the price falls to the trigger', () => {
    expect(shouldTrigger(order(stopSell), 95.05)).toBe(false);
    expect(shouldTrigger(order(stopSell), 95)).toBe(true);
    expect(shouldTrigger(order(stopSell), 90)).toBe(true);
  });

  it('applies only to open SL orders', () => {
    expect(shouldTrigger(order(limitBuy), 200)).toBe(false);
    expect(shouldTrigger(order(stopBuy, 'TRIGGERED'), 110)).toBe(false);
    expect(shouldTrigger(order(stopBuy, 'CANCELLED'), 110)).toBe(false);
  });
});

describe('matchOrder', () => {
  it('fills a MARKET order at the trade price and time', () => {
    expect(matchOrder(order(marketBuy), trade(101.5))).toEqual({
      ...order(marketBuy),
      status: 'FILLED',
      fillPrice: 101.5,
      filledAt: 99,
    });
  });

  it('fills a limit order at the trade price, which is never worse than the limit', () => {
    expect(matchOrder(order(limitBuy), trade(98)).fillPrice).toBe(98);
  });

  it('returns the very same object when nothing changes', () => {
    const resting = order(limitBuy);
    expect(matchOrder(resting, trade(101))).toBe(resting); // price not reached
    expect(matchOrder(resting, trade(50, 'INFY'))).toBe(resting); // another symbol
    const filled = order(marketBuy, 'FILLED');
    expect(matchOrder(filled, trade(100))).toBe(filled); // no longer working
  });

  it('only triggers an SL order when the price gaps past its limit', () => {
    // The price jumps from below 105 to 107: triggered, but 107 is above the 106 limit.
    expect(matchOrder(order(stopBuy), trade(107)).status).toBe('TRIGGERED');
  });

  it('triggers and fills an SL order on the same trade when the price allows', () => {
    const filled = matchOrder(order(stopSell), trade(94.5));
    expect(filled.status).toBe('FILLED');
    expect(filled.fillPrice).toBe(94.5);
  });
});
