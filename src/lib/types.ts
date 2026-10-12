/**
 * Shared types for TickDeck.
 *
 * This file is the contract between the three parts of the app:
 *   - the data layer (market feeds and the Zustand stores),
 *   - the chart (candles and indicators),
 *   - the UI components.
 * Every part imports its types from here, so a change in this file is a change
 * to the contract for all of them.
 *
 * Units: prices and quantities are plain numbers. Every `ts` / `createdAt` /
 * `filledAt` is Unix epoch time in milliseconds. The one exception is
 * `Candle.time`, which is in seconds because the chart library expects seconds.
 */

/** Order side. */
export type Side = 'BUY' | 'SELL';

/** One trade from the feed. */
export interface Tick {
  symbol: string;
  price: number;
  qty: number;
  /** Trade time in milliseconds. */
  ts: number;
}

/** One price level of an order book: the total quantity resting at `price`. */
export interface BookLevel {
  price: number;
  qty: number;
}

/** A full order-book snapshot for one symbol. */
export interface BookSnapshot {
  symbol: string;
  /** Buy orders, sorted by price descending (best bid first). */
  bids: BookLevel[];
  /** Sell orders, sorted by price ascending (best ask first). */
  asks: BookLevel[];
  ts: number;
}

/** Connection state of the market feed. */
export type FeedStatus = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Everything a feed can emit. This is a discriminated union: after checking
 * `msg.kind`, TypeScript knows which payload (`tick`, `book` or `status`) exists.
 */
export type FeedMessage =
  | { kind: 'tick'; tick: Tick }
  | { kind: 'book'; book: BookSnapshot }
  | { kind: 'status'; status: FeedStatus; detail?: string };

/** Where the market data comes from. */
export type FeedKind = 'simulated' | 'binance';

/**
 * A source of market data. The simulated feed and the Binance feed both
 * implement this interface, so the rest of the app does not care which one runs.
 */
export interface MarketFeed {
  readonly kind: FeedKind;
  connect(symbols: string[]): void;
  disconnect(): void;
  /** Adds a listener and returns a function that removes it again. */
  onMessage(cb: (m: FeedMessage) => void): () => void;
}

/** Candle width shown on the chart. */
export type Interval = '1s' | '5s' | '1m';

/** One OHLCV candle. */
export interface Candle {
  /**
   * Start of the candle's time bucket, in UTC seconds. lightweight-charts types
   * this as its `UTCTimestamp`, so cast it when handing candles to a series.
   */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * An order as the user enters it in the order ticket:
 *  - MARKET fills at the next trade.
 *  - LIMIT fills once the market price crosses `price`.
 *  - SL (stop-loss) waits until the market reaches `trigger`, then works like a LIMIT at `price`.
 */
export type OrderRequest =
  | { type: 'MARKET'; side: Side; symbol: string; qty: number }
  | { type: 'LIMIT'; side: Side; symbol: string; qty: number; price: number }
  | { type: 'SL'; side: Side; symbol: string; qty: number; trigger: number; price: number };

/** Order lifecycle. TRIGGERED means an SL order's trigger was hit and it now waits like a limit order. */
export type OrderStatus = 'OPEN' | 'TRIGGERED' | 'FILLED' | 'CANCELLED' | 'REJECTED';

/** An order after it has been placed. */
export interface Order {
  id: string;
  req: OrderRequest;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
  fillPrice?: number;
  /** Explanation shown to the user, for example why an order was rejected. */
  reason?: string;
}

/** Net holding in one symbol. */
export interface Position {
  symbol: string;
  /** Positive means long, negative means short. */
  qty: number;
  /** Average entry price of the open quantity. */
  avgPrice: number;
}

/** Latest price summary for one symbol, as shown in the watchlist. */
export interface Quote {
  symbol: string;
  last: number;
  /** Reference price that `change` and `changePct` are measured from. */
  open: number;
  change: number;
  changePct: number;
  ts: number;
  /** Direction of the latest price move: 1 up, -1 down, 0 unchanged. */
  dir: 1 | -1 | 0;
}
