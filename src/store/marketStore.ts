import { create } from 'zustand';
import type { BookSnapshot, FeedKind, FeedMessage, FeedStatus, Quote, Tick } from '@/lib/types';

/**
 * Live market data: quotes, order books and recent ticks for every symbol.
 *
 * The store is a module-level singleton. That is safe in Next.js here because
 * all market data arrives in the browser; the server only ever renders the
 * empty initial state.
 */

/** Ticks kept per symbol for the chart. Older ticks are dropped. */
export const MAX_TICKS_PER_SYMBOL = 5000;

export interface MarketState {
  feedKind: FeedKind;
  status: FeedStatus;
  symbols: string[];
  selected: string;
  quotes: Record<string, Quote>;
  books: Record<string, BookSnapshot>;
  /** Recent ticks per symbol for the chart, oldest first, at most 5000 per symbol. */
  ticksBySymbol: Record<string, Tick[]>;
  /** Throughput figures for the status bar, refreshed once a second by sampleMetrics(). */
  metrics: {
    /** Ticks received since the feed started. */
    ticksIn: number;
    /** Store commits (applyBatch calls) since the feed started. */
    commits: number;
    /** Ticks received per second, over the last sample. */
    lastSecondTicks: number;
    /** Store commits per second, over the last sample. */
    lastSecondCommits: number;
  };
  /** Applies one frame's worth of feed messages with a single set() call. */
  applyBatch: (msgs: FeedMessage[]) => void;
  select: (symbol: string) => void;
  /** Clears all market data for a new feed. */
  reset: (kind: FeedKind, symbols: string[]) => void;
  /** Publishes the counts gathered since the previous call. FeedProvider calls it once a second. */
  sampleMetrics: () => void;
}

const emptyMetrics = (): MarketState['metrics'] => ({
  ticksIn: 0,
  commits: 0,
  lastSecondTicks: 0,
  lastSecondCommits: 0,
});

/** Direction of a price move, which drives the green/red flash in the watchlist. */
function direction(from: number, to: number): Quote['dir'] {
  if (to > from) return 1;
  if (to < from) return -1;
  return 0;
}

/**
 * A symbol's quote after this frame's trades. `prev` is the quote from the
 * previous frame (if any) and `latest` is the newest trade in this frame.
 */
function nextQuote(prev: Quote | undefined, latest: Tick): Quote {
  // The first trade seen becomes the reference price that change is measured from.
  const open = prev?.open ?? latest.price;
  const change = latest.price - open;
  return {
    symbol: latest.symbol,
    last: latest.price,
    open,
    change,
    changePct: open === 0 ? 0 : (change / open) * 100, // in percent: 1.5 means +1.5%
    ts: latest.ts,
    dir: prev ? direction(prev.last, latest.price) : 0,
  };
}

/** Appends new ticks to a symbol's list, keeping only the newest MAX_TICKS_PER_SYMBOL. */
function appendTicks(prev: Tick[] | undefined, added: Tick[]): Tick[] {
  const all = prev ? prev.concat(added) : added;
  return all.length > MAX_TICKS_PER_SYMBOL ? all.slice(-MAX_TICKS_PER_SYMBOL) : all;
}

export const useMarketStore = create<MarketState>()((set) => {
  // Counts since the last sampleMetrics() call. They are plain variables, not
  // store state, on purpose: they change on every batch, and keeping them out
  // of the state means nothing re-renders until sampleMetrics() publishes them.
  let pendingTicks = 0;
  let pendingCommits = 0;
  let lastSampleAt = Date.now();

  return {
    feedKind: 'simulated',
    status: 'connecting',
    symbols: [],
    selected: '',
    quotes: {},
    books: {},
    ticksBySymbol: {},
    metrics: emptyMetrics(),

    applyBatch: (msgs) => {
      if (msgs.length === 0) return;

      // 1. Sort the batch: new ticks grouped by symbol, the newest book for each
      //    symbol, and the newest status.
      const newTicks: Record<string, Tick[]> = {};
      const newBooks: Record<string, BookSnapshot> = {};
      let newStatus: FeedStatus | undefined;
      for (const msg of msgs) {
        switch (msg.kind) {
          case 'tick':
            if (!newTicks[msg.tick.symbol]) newTicks[msg.tick.symbol] = [];
            newTicks[msg.tick.symbol].push(msg.tick);
            pendingTicks += 1;
            break;
          case 'book':
            newBooks[msg.book.symbol] = msg.book;
            break;
          case 'status':
            newStatus = msg.status;
            break;
        }
      }
      pendingCommits += 1;

      // 2. Commit everything with ONE set() call, so React renders once per batch.
      //    Symbols without new data keep their existing quote, book and tick
      //    array objects. The selector hooks compare those objects, so
      //    components showing other symbols do not re-render.
      set((s) => {
        const quotes = { ...s.quotes };
        const ticksBySymbol = { ...s.ticksBySymbol };
        for (const [symbol, ticks] of Object.entries(newTicks)) {
          quotes[symbol] = nextQuote(s.quotes[symbol], ticks[ticks.length - 1]);
          ticksBySymbol[symbol] = appendTicks(s.ticksBySymbol[symbol], ticks);
        }
        return {
          quotes,
          ticksBySymbol,
          books: { ...s.books, ...newBooks },
          status: newStatus ?? s.status,
        };
      });
    },

    select: (symbol) => set({ selected: symbol }),

    reset: (kind, symbols) => {
      pendingTicks = 0;
      pendingCommits = 0;
      lastSampleAt = Date.now();
      set((s) => ({
        feedKind: kind,
        status: 'connecting',
        symbols,
        // Keep the selection if the new feed still has that symbol.
        selected: symbols.includes(s.selected) ? s.selected : (symbols[0] ?? ''),
        quotes: {},
        books: {},
        ticksBySymbol: {},
        metrics: emptyMetrics(),
      }));
    },

    sampleMetrics: () => {
      const now = Date.now();
      // Divide by the real time elapsed, because timers can fire late (for
      // example in a background tab).
      const seconds = Math.max((now - lastSampleAt) / 1000, 0.001);
      const ticks = pendingTicks;
      const commits = pendingCommits;
      pendingTicks = 0;
      pendingCommits = 0;
      lastSampleAt = now;
      set((s) => ({
        metrics: {
          ticksIn: s.metrics.ticksIn + ticks,
          commits: s.metrics.commits + commits,
          lastSecondTicks: Math.round(ticks / seconds),
          lastSecondCommits: Math.round(commits / seconds),
        },
      }));
    },
  };
});
