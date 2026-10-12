// Imports through the package name, the same way the apps do, so this also
// checks the "@tickdeck/core" alias in jest.config.ts.
import * as core from '@tickdeck/core';

/**
 * Every runtime value the package must export. Types are erased at runtime,
 * so the type-checker covers those instead. If a module drops out of the
 * barrel (index.ts), this test fails before either app does.
 */
const EXPECTED_EXPORTS = [
  // symbols.ts
  'BINANCE_SYMBOLS',
  'SIM_SEED_PRICES',
  'SIM_SYMBOLS',
  // orders/
  'validateOrder',
  'isWorking',
  'shouldTrigger',
  'shouldFill',
  'matchOrder',
  'applyFill',
  // candles/
  'INTERVAL_SECONDS',
  'MAX_CANDLES',
  'bucketStart',
  'applyTick',
  'buildCandles',
  'sma',
  'vwap',
  // sim/simEngine.ts
  'DEFAULT_TICKS_PER_SECOND',
  'BOOK_DEPTH',
  'BOOK_INTERVAL_MS',
  'TICK_TIMER_MS',
  'TICK_SIZE',
  'roundToTick',
  'nextPrice',
  'makeBook',
  'createSimMarket',
  'runSimulation',
];

describe('@tickdeck/core', () => {
  it('exports the symbols, order rules, candle maths and simulated market', () => {
    const missing = EXPECTED_EXPORTS.filter((name) => !(name in core));
    expect(missing).toEqual([]);
  });

  it('exports working functions, not just names', () => {
    // A quick end-to-end use of three modules through the barrel.
    expect(core.validateOrder({ type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 1 }, 3100)).toBeNull();
    expect(core.roundToTick(1450.33)).toBe(1450.35);
    expect(core.buildCandles([{ symbol: 'TCS', price: 100, qty: 2, ts: 1_000 }], '1s')).toEqual([
      { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 2 },
    ]);
  });
});
