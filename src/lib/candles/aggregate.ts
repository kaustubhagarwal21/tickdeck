/**
 * Turns trades (ticks) into OHLCV candles.
 *
 * A candle summarises every trade in one time bucket: the first price (open),
 * the highest and lowest prices (high, low), the last price (close) and the
 * total traded quantity (volume).
 *
 * Every function here is pure: it never changes its inputs and returns new
 * arrays and objects instead. That keeps them easy to test, and safe to use
 * with React and Zustand, which detect changes by comparing references.
 */
import type { Candle, Interval, Tick } from '@/lib/types';

/** Length of each candle interval, in seconds. */
export const INTERVAL_SECONDS: Record<Interval, number> = {
  '1s': 1,
  '5s': 5,
  '1m': 60,
};

/** The most candles a list keeps. Older candles are dropped from the front. */
export const MAX_CANDLES = 600;

/**
 * Start of the time bucket that contains `tsMs`, in UTC seconds.
 *
 * Buckets are aligned to the Unix epoch, so a 1m bucket always starts at :00
 * seconds and a 5s bucket at :00, :05, :10 and so on. Example with 5s buckets:
 * a trade at 12:00:07.250 belongs to the candle that starts at 12:00:05.
 */
export function bucketStart(tsMs: number, interval: Interval): number {
  const seconds = INTERVAL_SECONDS[interval];
  return Math.floor(tsMs / (seconds * 1000)) * seconds;
}

/**
 * Adds one trade to a list of candles and returns the new list.
 *
 * - Same bucket as the last candle: a copy of that candle gets the new high,
 *   low, close and volume. The open never changes.
 * - A later bucket: a new candle is appended, with open = high = low = close =
 *   the trade price. Buckets with no trades get no candle; the chart simply
 *   draws the next candle beside the previous one.
 * - At most MAX_CANDLES are kept; the oldest candle is dropped to make room.
 *
 * Out-of-order trades (documented choice): both feeds deliver a symbol's
 * trades in time order, so a late trade is rare. When one does arrive:
 * - if it falls in the last candle's bucket, it is merged like any other trade.
 *   Within a bucket, arrival order counts as trade order, so it becomes the close;
 * - if it belongs to an earlier, already finished bucket, it is ignored and the
 *   same array is returned. Finished candles are already drawn, and the chart
 *   updates only its newest bar cheaply.
 */
export function applyTick(candles: Candle[], tick: Tick, interval: Interval): Candle[] {
  const time = bucketStart(tick.ts, interval);
  const last = candles[candles.length - 1];

  // A late trade for a finished candle: ignore it (see above).
  if (last && time < last.time) {
    return candles;
  }

  // Same bucket: replace the last candle with an updated copy.
  if (last && time === last.time) {
    const updated: Candle = {
      ...last,
      high: Math.max(last.high, tick.price),
      low: Math.min(last.low, tick.price),
      close: tick.price,
      volume: last.volume + tick.qty,
    };
    const next = candles.slice();
    next[next.length - 1] = updated;
    return next;
  }

  // A new bucket: open a new candle, dropping the oldest one if the list is full.
  const opened: Candle = {
    time,
    open: tick.price,
    high: tick.price,
    low: tick.price,
    close: tick.price,
    volume: tick.qty,
  };
  const next = candles.length >= MAX_CANDLES ? candles.slice(-(MAX_CANDLES - 1)) : candles.slice();
  next.push(opened);
  return next;
}

/**
 * Builds candles from scratch from a list of ticks, oldest first.
 *
 * It applies the ticks one by one with applyTick, so a full rebuild and the
 * live, tick-by-tick path always produce exactly the same candles.
 */
export function buildCandles(ticks: readonly Tick[], interval: Interval): Candle[] {
  let candles: Candle[] = [];
  for (const tick of ticks) {
    candles = applyTick(candles, tick, interval);
  }
  return candles;
}
