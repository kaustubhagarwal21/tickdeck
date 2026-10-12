import type { FeedKind, MarketFeed } from '@/lib/types';
import { BINANCE_SYMBOLS, SIM_SYMBOLS } from '@/lib/symbols';
import { createBinanceFeed } from './binanceFeed';
import { DEFAULT_TICKS_PER_SECOND } from './simEngine';
import { createSimulatedFeed, type SimulatedFeedOptions } from './simulatedFeed';

/** Upper limit for ?rate=, so a typo cannot freeze the browser. */
export const MAX_TICKS_PER_SECOND = 10_000;

export interface FeedChoice {
  kind: FeedKind;
  /** Trade rate for the simulated feed. The Binance feed ignores it. */
  ticksPerSecond: number;
}

/**
 * Reads the feed choice from the page's query string:
 *   ?feed=sim     the simulated NSE feed; any other value, or none, means Binance
 *   ?rate=1000    simulated trades per second (default 400, at most 10,000)
 */
export function parseFeedParams(params: URLSearchParams): FeedChoice {
  const kind: FeedKind = params.get('feed') === 'sim' ? 'simulated' : 'binance';
  const rate = Number(params.get('rate')); // a missing value gives 0, a non-number NaN
  const ticksPerSecond = rate > 0 ? Math.min(rate, MAX_TICKS_PER_SECOND) : DEFAULT_TICKS_PER_SECOND;
  return { kind, ticksPerSecond };
}

/** The instruments each feed streams. */
export function symbolsFor(kind: FeedKind): string[] {
  return kind === 'binance' ? BINANCE_SYMBOLS : SIM_SYMBOLS;
}

/** Creates the feed for `kind`. Nothing streams until its connect() is called. */
export function createFeed(kind: FeedKind, options: SimulatedFeedOptions = {}): MarketFeed {
  return kind === 'binance' ? createBinanceFeed() : createSimulatedFeed(options);
}
