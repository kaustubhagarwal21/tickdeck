import type { Candle } from '@/lib/types';
import { sma, vwap } from '../indicators';

/** A candle at `time` with the given close. Pass `extra` to set high, low or volume for VWAP. */
function candle(time: number, close: number, extra: Partial<Candle> = {}): Candle {
  return { time, open: close, high: close, low: close, close, volume: 1, ...extra };
}

describe('sma', () => {
  const candles = [10, 11, 12, 13, 20].map((close, i) => candle(1_000 + i, close));

  it('averages the last `period` closes, starting at the first full window', () => {
    // (10 + 11 + 12) / 3 = 11, (11 + 12 + 13) / 3 = 12, (12 + 13 + 20) / 3 = 15
    expect(sma(candles, 3)).toEqual([
      { time: 1_002, value: 11 },
      { time: 1_003, value: 12 },
      { time: 1_004, value: 15 },
    ]);
  });

  it('returns the closes themselves for period 1', () => {
    expect(sma(candles, 1).map((p) => p.value)).toEqual([10, 11, 12, 13, 20]);
  });

  it('returns nothing until there are enough candles', () => {
    expect(sma(candles, 6)).toEqual([]);
    expect(sma([], 20)).toEqual([]);
  });

  it('agrees with a plain average over a long series (the running sum does not drift)', () => {
    const closes = Array.from({ length: 200 }, (_, i) => 1_450 + 10 * Math.sin(i));
    const points = sma(
      closes.map((close, i) => candle(i, close)),
      20,
    );

    expect(points).toHaveLength(181);
    points.forEach((point, k) => {
      const window = closes.slice(k, k + 20);
      const average = window.reduce((sum, close) => sum + close, 0) / 20;
      expect(point.value).toBeCloseTo(average, 9);
    });
  });

  it('rejects a period that is not a positive whole number', () => {
    expect(() => sma(candles, 0)).toThrow(RangeError);
    expect(() => sma(candles, 2.5)).toThrow(RangeError);
  });
});

describe('vwap', () => {
  it("weights each candle's typical price by its volume", () => {
    const candles = [
      candle(1, 12, { high: 12, low: 9, volume: 10 }), // typical price (12 + 9 + 12) / 3 = 11
      candle(2, 15, { high: 15, low: 12, volume: 20 }), // typical price 14
      candle(3, 9, { high: 12, low: 9, volume: 30 }), // typical price 10
    ];

    // 11*10 = 110            -> 110 / 10 = 11
    // 110 + 14*20 = 390      -> 390 / 30 = 13
    // 390 + 10*30 = 690      -> 690 / 60 = 11.5
    expect(vwap(candles)).toEqual([
      { time: 1, value: 11 },
      { time: 2, value: 13 },
      { time: 3, value: 11.5 },
    ]);
  });

  it('skips candles until the first volume, where VWAP would be 0 / 0', () => {
    const candles = [candle(1, 10, { volume: 0 }), candle(2, 12, { volume: 0 }), candle(3, 14, { volume: 5 })];
    expect(vwap(candles)).toEqual([{ time: 3, value: 14 }]);
  });

  it('carries the value forward through a candle with no volume', () => {
    const candles = [candle(1, 10, { volume: 2 }), candle(2, 50, { volume: 0 })];
    expect(vwap(candles)).toEqual([
      { time: 1, value: 10 },
      { time: 2, value: 10 },
    ]);
  });

  it('returns nothing for no candles', () => {
    expect(vwap([])).toEqual([]);
  });
});
