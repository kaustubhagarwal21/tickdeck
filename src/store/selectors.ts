import type { BookSnapshot, FeedKind, FeedStatus, Quote, Tick } from '@tickdeck/core';
import { useMarketStore, type MarketState } from './marketStore';

// Narrow selector hooks over the market store. A component re-renders only
// when the value its selector returns changes (compared with Object.is). So a
// new TCS tick re-renders the TCS row and leaves the INFY row alone, because
// applyBatch gives INFY the very same quote object as before.
//
// Every selector here returns a value that already exists in the state, so
// plain Object.is comparison is enough. A selector that builds a new object
// or array on each call would need zustand's useShallow instead; otherwise
// every store update would look like a change.

// One shared empty array for symbols without ticks. Returning a fresh [] on
// every call would count as a change each time and re-render forever.
const NO_TICKS: Tick[] = [];

export const useQuote = (symbol: string): Quote | undefined =>
  useMarketStore((s) => s.quotes[symbol]);

export const useBook = (symbol: string): BookSnapshot | undefined =>
  useMarketStore((s) => s.books[symbol]);

export const useSelected = (): string => useMarketStore((s) => s.selected);

export const useTicks = (symbol: string): Tick[] =>
  useMarketStore((s) => s.ticksBySymbol[symbol] ?? NO_TICKS);

export const useFeedStatus = (): FeedStatus => useMarketStore((s) => s.status);

/** Changes once a second, when FeedProvider samples the metrics. */
export const useMetrics = (): MarketState['metrics'] => useMarketStore((s) => s.metrics);

/** The symbols the current feed streams. Changes only when the feed changes. */
export const useSymbols = (): string[] => useMarketStore((s) => s.symbols);

/** Which feed is running. It switches to 'simulated' if Binance is unavailable. */
export const useFeedKind = (): FeedKind => useMarketStore((s) => s.feedKind);
