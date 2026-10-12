/**
 * @tickdeck/core: the platform-independent part of TickDeck.
 *
 * Everything exported here is plain TypeScript with no React, no DOM and no
 * browser-only API, so the web app (Next.js) and a future mobile app can share
 * it unchanged. Apps import from the package name only:
 *
 *   import { matchOrder, type Order } from '@tickdeck/core';
 *
 * The name resolves to this file through tsconfig.json "paths" (for TypeScript
 * and the Next.js build) and jest.config.ts "moduleNameMapper" (for Jest).
 */

// The shared contract: ticks, books, feed messages, candles, orders, positions, quotes.
export * from './types';

// The instruments each feed streams, and the simulated stocks' starting prices.
export * from './symbols';

// Paper-trading rules: validate an order, match it against trades, update positions.
export * from './orders/validate';
export * from './orders/match';
export * from './orders/positions';

// Trades to OHLCV candles, and the SMA / VWAP indicators drawn on the chart.
export * from './candles/aggregate';
export * from './candles/indicators';

// The simulated NSE market (random-walk trades and order books on timers).
export * from './sim/simEngine';
