/**
 * The simulated NSE market. Both the web app's Web Worker
 * (src/lib/feed/sim.worker.ts) and its main-thread fallback
 * (src/lib/feed/simulatedFeed.ts) run this same code.
 *
 * It needs no DOM and no Worker API, only setInterval and Date.now, which every
 * JavaScript runtime has. That is why it lives in @tickdeck/core.
 *
 * It has two layers:
 *  1. createSimMarket, nextPrice and makeBook generate trades and order books.
 *     They use no timers and take their random numbers as an argument, so a
 *     test can feed in a fixed sequence and know exactly what comes out.
 *  2. runSimulation drives a market with timers and hands out batches of
 *     messages at the configured rate.
 */
import type { BookLevel, BookSnapshot, FeedMessage, Tick } from '../types';
import { SIM_SEED_PRICES } from '../symbols';

/** Trades per second across all symbols when the URL has no ?rate=. */
export const DEFAULT_TICKS_PER_SECOND = 400;
/** Price levels per side in each order book. */
export const BOOK_DEPTH = 10;
/** A fresh order book for every symbol is sent this often. */
export const BOOK_INTERVAL_MS = 100;
/** The trade timer fires this often (40 times a second) and sends the trades that are due. */
export const TICK_TIMER_MS = 25;

/** Prices move in steps of 5 paise (0.05), the tick size of most NSE stocks: 20 steps per rupee. */
const STEPS_PER_RUPEE = 20;
export const TICK_SIZE = 1 / STEPS_PER_RUPEE;

/** Largest random move per trade: 0.02% of the price (about 0.29 on a 1450 stock). */
const MAX_STEP = 0.0002;
/**
 * How strongly each trade pulls the price back toward its starting level. A
 * pure random walk drifts without limit over a long session; this small pull
 * keeps each price within a few percent of where it started.
 */
const PULL_TO_START = 0.0001;

/** What the page sends the simulation worker to start it. */
export interface SimWorkerStart {
  symbols: string[];
  ticksPerSecond: number;
}

/**
 * Rounds a price to the nearest tick (0.05). Dividing by a whole number at the
 * end, rather than multiplying by 0.05, avoids results like 1450.3500000000001.
 */
export function roundToTick(price: number): number {
  return Math.round(price * STEPS_PER_RUPEE) / STEPS_PER_RUPEE;
}

/**
 * One step of the random walk: the next trade price after `last`.
 * `start` is the symbol's starting price, which the walk is gently pulled back
 * toward. `random` works like Math.random and returns a number in [0, 1).
 */
export function nextPrice(last: number, start: number, random: () => number): number {
  const noise = (random() * 2 - 1) * MAX_STEP; // between -0.02% and +0.02%
  const pull = ((start - last) / start) * PULL_TO_START;
  return Math.max(TICK_SIZE, roundToTick(last * (1 + noise + pull)));
}

/** A random resting quantity of 50 to 1000 shares. */
function randomSize(random: () => number): number {
  return 50 + Math.floor(random() * 951);
}

/**
 * A 10-level order book around `mid`, with levels one tick apart: the best bid
 * is one tick below `mid` and the best ask one tick above. Sizes are random.
 */
export function makeBook(symbol: string, mid: number, ts: number, random: () => number): BookSnapshot {
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  for (let level = 1; level <= BOOK_DEPTH; level++) {
    const bidPrice = roundToTick(mid - level * TICK_SIZE);
    if (bidPrice > 0) bids.push({ price: bidPrice, qty: randomSize(random) });
    asks.push({ price: roundToTick(mid + level * TICK_SIZE), qty: randomSize(random) });
  }
  return { symbol, bids, asks, ts };
}

export interface SimMarket {
  /** The next trade, for a randomly chosen symbol. */
  nextTick(ts: number): Tick;
  /** A fresh order book for every symbol, around its latest trade price. */
  books(ts: number): BookSnapshot[];
}

/**
 * A simulated market: remembers each symbol's latest price and generates
 * trades and books from it. The same `random` sequence always produces the
 * same trades, which is what the tests rely on.
 */
export function createSimMarket(symbols: string[], random: () => number = Math.random): SimMarket {
  const start: Record<string, number> = {};
  const last: Record<string, number> = {};
  for (const symbol of symbols) {
    start[symbol] = SIM_SEED_PRICES[symbol] ?? 100;
    last[symbol] = start[symbol];
  }

  return {
    nextTick(ts) {
      const symbol = symbols[Math.floor(random() * symbols.length)];
      const price = nextPrice(last[symbol], start[symbol], random);
      last[symbol] = price;
      return { symbol, price, qty: 1 + Math.floor(random() * 100), ts };
    },

    books(ts) {
      return symbols.map((symbol) => makeBook(symbol, last[symbol], ts, random));
    },
  };
}

/**
 * Runs a simulated market on timers and calls `emit` with each batch of
 * messages: about `ticksPerSecond` trades a second in total, plus a fresh book
 * for every symbol every 100 ms. Returns a function that stops it.
 */
export function runSimulation(
  symbols: string[],
  ticksPerSecond: number,
  emit: (batch: FeedMessage[]) => void,
): () => void {
  if (symbols.length === 0) return () => {};
  const market = createSimMarket(symbols);
  let due = 0; // trades owed, including the fraction left over from the previous call

  const tickTimer = setInterval(() => {
    due += (ticksPerSecond * TICK_TIMER_MS) / 1000; // at 400 a second: 10 per call
    const count = Math.floor(due);
    due -= count;
    if (count === 0) return;

    const now = Date.now();
    const batch: FeedMessage[] = [];
    for (let i = 0; i < count; i++) batch.push({ kind: 'tick', tick: market.nextTick(now) });
    emit(batch);
  }, TICK_TIMER_MS);

  const bookTimer = setInterval(() => {
    const now = Date.now();
    emit(market.books(now).map((book): FeedMessage => ({ kind: 'book', book })));
  }, BOOK_INTERVAL_MS);

  return () => {
    clearInterval(tickTimer);
    clearInterval(bookTimer);
  };
}
