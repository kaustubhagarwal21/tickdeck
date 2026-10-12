import type { Candle, Tick } from '@/lib/types';
import { applyTick, bucketStart, buildCandles, MAX_CANDLES } from '../aggregate';

// 12 Oct 2026, 09:15:00 IST (03:45:00 UTC), when NSE opens. It is a whole
// minute, so it is also the start of a 1s, a 5s and a 1m bucket.
const T0_MS = Date.UTC(2026, 9, 12, 3, 45, 0);
/** The same instant in seconds, the unit candles use. */
const T0 = T0_MS / 1000;

/** A trade `offsetMs` milliseconds after T0. */
function tick(offsetMs: number, price: number, qty = 1): Tick {
  return { symbol: 'RELIANCE', price, qty, ts: T0_MS + offsetMs };
}

/** Deep-freezes candles, so any attempt to modify them throws a TypeError. */
function frozen(...candles: Candle[]): Candle[] {
  return Object.freeze(candles.map((c) => Object.freeze({ ...c }))) as Candle[];
}

describe('bucketStart', () => {
  it('returns the start of the bucket in seconds', () => {
    expect(bucketStart(T0_MS, '1s')).toBe(T0);
    expect(bucketStart(T0_MS + 999, '1s')).toBe(T0);
    expect(bucketStart(T0_MS + 1_000, '1s')).toBe(T0 + 1);
  });

  it('puts the last millisecond of a bucket in that bucket and the next one in the next bucket', () => {
    expect(bucketStart(T0_MS + 4_999, '5s')).toBe(T0);
    expect(bucketStart(T0_MS + 5_000, '5s')).toBe(T0 + 5);
    expect(bucketStart(T0_MS + 59_999, '1m')).toBe(T0);
    expect(bucketStart(T0_MS + 60_000, '1m')).toBe(T0 + 60);
  });

  it('aligns buckets to the clock, not to the first trade', () => {
    // 09:15:07.250 is in the 5s bucket that starts at 09:15:05 and the 1m bucket that starts at 09:15:00.
    expect(bucketStart(T0_MS + 7_250, '5s')).toBe(T0 + 5);
    expect(bucketStart(T0_MS + 7_250, '1m')).toBe(T0);
    expect(bucketStart(0, '1m')).toBe(0);
    expect(bucketStart(59_999, '1m')).toBe(0);
  });
});

describe('applyTick', () => {
  it('opens a candle from the first trade', () => {
    expect(applyTick([], tick(250, 100, 3), '1s')).toEqual([
      { time: T0, open: 100, high: 100, low: 100, close: 100, volume: 3 },
    ]);
  });

  it('updates high, low, close and volume within a bucket, and keeps the open', () => {
    let candles: Candle[] = [];
    candles = applyTick(candles, tick(0, 100, 1), '5s');
    candles = applyTick(candles, tick(1_000, 104, 2), '5s');
    candles = applyTick(candles, tick(2_000, 97, 3), '5s');
    candles = applyTick(candles, tick(4_999, 101, 4), '5s');

    expect(candles).toEqual([{ time: T0, open: 100, high: 104, low: 97, close: 101, volume: 10 }]);
  });

  it('appends a new candle when a trade falls in a later bucket', () => {
    const one = applyTick([], tick(0, 100), '5s');
    const two = applyTick(one, tick(5_000, 102, 2), '5s');

    expect(two).toEqual([
      { time: T0, open: 100, high: 100, low: 100, close: 100, volume: 1 },
      { time: T0 + 5, open: 102, high: 102, low: 102, close: 102, volume: 2 },
    ]);
  });

  it('creates no candles for buckets without trades', () => {
    const candles = applyTick(applyTick([], tick(0, 100), '1s'), tick(12_000, 101), '1s');
    expect(candles.map((c) => c.time)).toEqual([T0, T0 + 12]);
  });

  it('returns new arrays and candles instead of changing its input', () => {
    // The input is frozen, so a mutating applyTick would throw here.
    const input = frozen({ time: T0, open: 100, high: 100, low: 100, close: 100, volume: 1 });

    const sameBucket = applyTick(input, tick(500, 105), '1s');
    const newBucket = applyTick(input, tick(1_000, 99), '1s');

    expect(sameBucket).not.toBe(input);
    expect(sameBucket[0]).toEqual({ time: T0, open: 100, high: 105, low: 100, close: 105, volume: 2 });
    expect(newBucket).toHaveLength(2);
    // An unchanged candle is shared between the old and new arrays, not copied.
    expect(newBucket[0]).toBe(input[0]);
  });

  it(`keeps at most ${MAX_CANDLES} candles by dropping the oldest`, () => {
    const ticks = Array.from({ length: MAX_CANDLES + 5 }, (_, i) => tick(i * 1_000, 100 + i));
    const candles = buildCandles(ticks, '1s');

    expect(candles).toHaveLength(MAX_CANDLES);
    expect(candles[0].time).toBe(T0 + 5); // the first five candles were dropped
    expect(candles[MAX_CANDLES - 1].time).toBe(T0 + MAX_CANDLES + 4);
  });

  describe('out-of-order trades', () => {
    it('ignores a late trade for a finished bucket and returns the same array', () => {
      const candles = buildCandles([tick(0, 100), tick(5_000, 101)], '5s');

      // This trade belongs to the first 5s candle, which is already finished.
      const after = applyTick(candles, tick(4_000, 200, 50), '5s');

      expect(after).toBe(candles);
    });

    it('merges a late trade that is still in the newest bucket, in arrival order', () => {
      const candles = buildCandles([tick(0, 100), tick(5_200, 101)], '5s');

      // 100 ms older than the previous trade, but in the same (newest) bucket.
      const after = applyTick(candles, tick(5_100, 99, 2), '5s');

      expect(after[1]).toEqual({ time: T0 + 5, open: 101, high: 101, low: 99, close: 99, volume: 3 });
    });
  });
});

describe('buildCandles', () => {
  // Six trades between 09:15:00 and 09:16:01.
  const ticks: Tick[] = [
    tick(100, 100, 1),
    tick(600, 102, 2),
    tick(1_200, 101, 1),
    tick(4_900, 98, 5),
    tick(5_000, 99, 1),
    tick(61_000, 105, 3),
  ];

  it('builds 1s candles', () => {
    expect(buildCandles(ticks, '1s')).toEqual([
      { time: T0, open: 100, high: 102, low: 100, close: 102, volume: 3 },
      { time: T0 + 1, open: 101, high: 101, low: 101, close: 101, volume: 1 },
      { time: T0 + 4, open: 98, high: 98, low: 98, close: 98, volume: 5 },
      { time: T0 + 5, open: 99, high: 99, low: 99, close: 99, volume: 1 },
      { time: T0 + 61, open: 105, high: 105, low: 105, close: 105, volume: 3 },
    ]);
  });

  it('builds 5s candles', () => {
    expect(buildCandles(ticks, '5s')).toEqual([
      { time: T0, open: 100, high: 102, low: 98, close: 98, volume: 9 },
      { time: T0 + 5, open: 99, high: 99, low: 99, close: 99, volume: 1 },
      { time: T0 + 60, open: 105, high: 105, low: 105, close: 105, volume: 3 },
    ]);
  });

  it('builds 1m candles', () => {
    expect(buildCandles(ticks, '1m')).toEqual([
      { time: T0, open: 100, high: 102, low: 98, close: 99, volume: 10 },
      { time: T0 + 60, open: 105, high: 105, low: 105, close: 105, volume: 3 },
    ]);
  });

  it('matches applying the ticks one at a time, as the live chart does', () => {
    // The chart rebuilds with buildCandles but updates live with applyTick;
    // both paths must agree or the chart would jump on every rebuild.
    let live: Candle[] = [];
    for (const t of ticks) live = applyTick(live, t, '5s');

    expect(buildCandles(ticks, '5s')).toEqual(live);
  });

  it('returns no candles for no ticks', () => {
    expect(buildCandles([], '1m')).toEqual([]);
  });
});
