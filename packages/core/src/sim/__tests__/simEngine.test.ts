import type { FeedMessage } from '../../types';
import { SIM_SEED_PRICES, SIM_SYMBOLS } from '../../symbols';
import {
  BOOK_DEPTH,
  TICK_SIZE,
  createSimMarket,
  makeBook,
  nextPrice,
  roundToTick,
  runSimulation,
} from '../simEngine';

/** A small deterministic stand-in for Math.random (a linear congruential generator). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** True when `price` is a whole number of ticks (multiples of 0.05). */
const isOnTick = (price: number) => Math.abs(price * 20 - Math.round(price * 20)) < 1e-9;

describe('roundToTick', () => {
  it('rounds to the nearest 0.05 without floating-point noise', () => {
    expect(roundToTick(1450.36)).toBe(1450.35);
    expect(roundToTick(1450.38)).toBe(1450.4);
    expect(String(roundToTick(1450.349999))).toBe('1450.35');
  });
});

describe('nextPrice', () => {
  it('stays put when there is no noise and the price is at its start', () => {
    expect(nextPrice(1450, 1450, () => 0.5)).toBe(1450);
  });

  it('moves at most 0.02% per trade, in whole ticks', () => {
    const up = nextPrice(1450, 1450, () => 0.999999);
    const down = nextPrice(1450, 1450, () => 0);

    expect(up).toBeGreaterThan(1450);
    expect(down).toBeLessThan(1450);
    expect(up - 1450).toBeLessThanOrEqual(1450 * 0.0002 + TICK_SIZE / 2);
    expect(1450 - down).toBeLessThanOrEqual(1450 * 0.0002 + TICK_SIZE / 2);
    expect(isOnTick(up) && isOnTick(down)).toBe(true);
  });

  it('pulls a long walk back toward the starting price', () => {
    const random = seeded(7);
    let price = 1450 * 1.1; // start 10% above the starting price
    for (let i = 0; i < 20_000; i++) price = nextPrice(price, 1450, random);

    expect(Math.abs(price - 1450) / 1450).toBeLessThan(0.05);
  });

  it('never goes below one tick', () => {
    expect(nextPrice(TICK_SIZE, 100, () => 0)).toBe(TICK_SIZE);
  });
});

describe('makeBook', () => {
  it('builds 10 levels a side, one tick apart, bids below the mid and asks above', () => {
    const book = makeBook('TCS', 3100, 123, seeded(1));

    expect(book.symbol).toBe('TCS');
    expect(book.ts).toBe(123);
    expect(book.bids).toHaveLength(BOOK_DEPTH);
    expect(book.asks).toHaveLength(BOOK_DEPTH);
    expect(book.bids[0].price).toBe(3099.95); // best bid first
    expect(book.asks[0].price).toBe(3100.05); // best ask first
    expect(book.bids[9].price).toBe(3099.5);
    expect(book.asks[9].price).toBe(3100.5);

    for (const level of [...book.bids, ...book.asks]) {
      expect(level.qty).toBeGreaterThanOrEqual(50);
      expect(level.qty).toBeLessThanOrEqual(1000);
    }
  });
});

describe('createSimMarket', () => {
  it('starts each symbol at its seed price', () => {
    // random() = 0.5 picks symbol index 3 (HDFCBANK), moves nothing, and gives qty 51.
    const market = createSimMarket(SIM_SYMBOLS, () => 0.5);

    expect(market.nextTick(1000)).toEqual({ symbol: 'HDFCBANK', price: 985, qty: 51, ts: 1000 });
    for (const book of market.books(1000)) {
      expect(book.bids[0].price).toBe(roundToTick(SIM_SEED_PRICES[book.symbol] - TICK_SIZE));
    }
  });

  it('replays exactly: the same random sequence gives the same trades', () => {
    const a = createSimMarket(SIM_SYMBOLS, seeded(42));
    const b = createSimMarket(SIM_SYMBOLS, seeded(42));
    const ticksA = Array.from({ length: 200 }, (_, i) => a.nextTick(i));
    const ticksB = Array.from({ length: 200 }, (_, i) => b.nextTick(i));

    expect(ticksA).toEqual(ticksB);
  });

  it('only trades its own symbols, at positive whole-tick prices and quantities', () => {
    const market = createSimMarket(['SBIN', 'TCS'], seeded(3));
    for (let i = 0; i < 1000; i++) {
      const tick = market.nextTick(i);
      expect(['SBIN', 'TCS']).toContain(tick.symbol);
      expect(tick.price).toBeGreaterThan(0);
      expect(isOnTick(tick.price)).toBe(true);
      expect(Number.isInteger(tick.qty) && tick.qty >= 1 && tick.qty <= 100).toBe(true);
    }
  });
});

describe('runSimulation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const collect = (symbols: string[], ticksPerSecond: number) => {
    const messages: FeedMessage[] = [];
    const stop = runSimulation(symbols, ticksPerSecond, (batch) => messages.push(...batch));
    const count = (kind: FeedMessage['kind']) => messages.filter((m) => m.kind === kind).length;
    return { stop, count };
  };

  it('emits ticksPerSecond trades a second', () => {
    const { stop, count } = collect(SIM_SYMBOLS, 400);
    jest.advanceTimersByTime(1000);
    expect(count('tick')).toBe(400);
    stop();
  });

  it('handles rates below one trade per timer call', () => {
    const { stop, count } = collect(SIM_SYMBOLS, 10); // a quarter of a trade per 25 ms call
    jest.advanceTimersByTime(1000);
    expect(count('tick')).toBe(10);
    stop();
  });

  it('sends a book for every symbol every 100 ms', () => {
    const { stop, count } = collect(SIM_SYMBOLS, 400);
    jest.advanceTimersByTime(100);
    expect(count('book')).toBe(SIM_SYMBOLS.length);
    jest.advanceTimersByTime(900);
    expect(count('book')).toBe(SIM_SYMBOLS.length * 10);
    stop();
  });

  it('stops when the returned function is called', () => {
    const { stop, count } = collect(SIM_SYMBOLS, 400);
    jest.advanceTimersByTime(100);
    stop();
    const before = count('tick') + count('book');
    jest.advanceTimersByTime(1000);
    expect(count('tick') + count('book')).toBe(before);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does nothing without symbols', () => {
    const { count } = collect([], 400);
    jest.advanceTimersByTime(1000);
    expect(count('tick') + count('book')).toBe(0);
  });
});
