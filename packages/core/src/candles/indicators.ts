/**
 * Chart indicators computed from candles. Both functions are pure and return
 * one point per candle that has a value, ready to draw as a line on the chart.
 */
import type { Candle } from '../types';

/** One point of an indicator line: a candle's time (UTC seconds) and the value there. */
export interface LinePoint {
  time: number;
  value: number;
}

/**
 * Simple moving average (SMA): the average close of the last `period` candles.
 *
 * The first point is at candle number `period`, because earlier candles do not
 * have enough history. Instead of re-adding `period` closes for every candle,
 * it keeps a running sum: add the newest close, subtract the one that just left
 * the window. That makes the whole series O(n) instead of O(n * period).
 */
export function sma(candles: readonly Candle[], period: number): LinePoint[] {
  if (!Number.isInteger(period) || period < 1) {
    throw new RangeError(`SMA period must be a positive whole number, got ${period}`);
  }

  const points: LinePoint[] = [];
  let windowSum = 0;
  for (let i = 0; i < candles.length; i++) {
    windowSum += candles[i].close;
    if (i >= period) {
      windowSum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      points.push({ time: candles[i].time, value: windowSum / period });
    }
  }
  return points;
}

/**
 * Volume-weighted average price (VWAP), anchored at the first candle given.
 *
 *   VWAP at candle i = sum(typical price * volume) / sum(volume), over candles 0..i
 *
 * A candle does not keep its individual trades, so each candle's trades are
 * represented by its typical price, (high + low + close) / 3, which is the
 * usual way to compute VWAP from candles.
 *
 * Candles are skipped until some volume has traded, because VWAP is undefined
 * (0 / 0) before the first trade.
 */
export function vwap(candles: readonly Candle[]): LinePoint[] {
  const points: LinePoint[] = [];
  let priceTimesVolume = 0;
  let volume = 0;
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    priceTimesVolume += typicalPrice * candle.volume;
    volume += candle.volume;
    if (volume > 0) {
      points.push({ time: candle.time, value: priceTimesVolume / volume });
    }
  }
  return points;
}
