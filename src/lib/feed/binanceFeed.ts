import type { BookLevel, FeedMessage, FeedStatus, MarketFeed } from '@tickdeck/core';
import { createEmitter } from './emitter';

/** Binance's public market-data endpoint for combined streams. No API key is needed. */
const STREAM_URL = 'wss://stream.binance.com:9443/stream';
/** The first reconnect waits this long; each further failure doubles the wait... */
const FIRST_RETRY_MS = 1_000;
/** ...up to this cap. */
const MAX_RETRY_MS = 15_000;

/**
 * URL of one combined stream that carries, for every symbol, its trades and
 * its top 10 order-book levels every 100 ms. Binance stream names are lower case.
 */
export function binanceStreamUrl(symbols: string[]): string {
  const streams = symbols.flatMap((symbol) => {
    const name = symbol.toLowerCase();
    return [`${name}@trade`, `${name}@depth10@100ms`];
  });
  return `${STREAM_URL}?streams=${streams.join('/')}`;
}

/** Wait before reconnect attempt number `attempt` (0, 1, 2...): 1 s, 2 s, 4 s, 8 s, then 15 s. */
export function backoffDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
}

// ---------------------------------------------------------------------------
// Raw messages. JSON.parse returns `any`, so a parsed message is stored as
// `unknown` and checked with the type guards below before any field is read.
// The interfaces list only the fields TickDeck uses.

/** The combined stream wraps every message in an envelope that names its stream. */
interface RawEnvelope {
  stream: string; // e.g. "btcusdt@trade"
  data: unknown;
}

/** A `<symbol>@trade` message: one trade. Binance sends numbers as strings. */
interface RawTrade {
  e: 'trade';
  s: string; // symbol, e.g. "BTCUSDT"
  p: string; // price
  q: string; // quantity
  T: number; // trade time in ms
}

/** One order-book level as Binance sends it: [price, quantity]. */
type RawLevel = [string, string];

/** A `<symbol>@depth10@100ms` message: the top 10 levels per side. It has no symbol field. */
interface RawDepth {
  bids: RawLevel[]; // best (highest) bid first
  asks: RawLevel[]; // best (lowest) ask first
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope(value: unknown): value is RawEnvelope {
  return isObject(value) && typeof value.stream === 'string' && 'data' in value;
}

function isTrade(value: unknown): value is RawTrade {
  return (
    isObject(value) &&
    value.e === 'trade' &&
    typeof value.s === 'string' &&
    typeof value.p === 'string' &&
    typeof value.q === 'string' &&
    typeof value.T === 'number'
  );
}

function isLevels(value: unknown): value is RawLevel[] {
  return (
    Array.isArray(value) &&
    value.every(
      (level: unknown) =>
        Array.isArray(level) && typeof level[0] === 'string' && typeof level[1] === 'string',
    )
  );
}

function isDepth(value: unknown): value is RawDepth {
  return isObject(value) && isLevels(value.bids) && isLevels(value.asks);
}

function toLevels(levels: RawLevel[]): BookLevel[] {
  return levels.map(([price, qty]) => ({ price: Number(price), qty: Number(qty) }));
}

/**
 * Converts one raw socket message into a FeedMessage, or returns null for
 * anything it does not recognise (bad JSON, other event types), which the feed
 * then ignores. `now` stamps book snapshots, because depth messages carry no time.
 */
export function parseBinanceMessage(text: string, now: number = Date.now()): FeedMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isEnvelope(json)) return null;
  const { stream, data } = json;

  if (isTrade(data)) {
    const price = Number(data.p);
    const qty = Number(data.q);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
    return { kind: 'tick', tick: { symbol: data.s, price, qty, ts: data.T } };
  }

  if (isDepth(data)) {
    // The symbol is the part of the stream name before the first '@'.
    const symbol = stream.split('@')[0].toUpperCase();
    return {
      kind: 'book',
      book: { symbol, bids: toLevels(data.bids), asks: toLevels(data.asks), ts: now },
    };
  }

  return null;
}

/**
 * A MarketFeed that streams live crypto trades and order books from Binance.
 *
 * If the socket closes unexpectedly, the feed reconnects after 1 s, 2 s, 4 s,
 * 8 s, then every 15 s, and reports each step as a status message. A
 * successful connection resets the wait to 1 s.
 */
export function createBinanceFeed(): MarketFeed {
  const listeners = createEmitter<FeedMessage>();
  let symbols: string[] = [];
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0; // failed attempts since the last successful connection
  let active = false; // true between connect() and disconnect()

  const emitStatus = (status: FeedStatus, detail?: string) =>
    listeners.emit({ kind: 'status', status, detail });

  function open() {
    emitStatus('connecting');
    const ws = new WebSocket(binanceStreamUrl(symbols));
    socket = ws;

    // Each handler first checks that `ws` is still the current socket, so late
    // events from a socket that was already closed or replaced are ignored.
    ws.onopen = () => {
      if (socket !== ws) return;
      attempt = 0;
      emitStatus('open');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (socket !== ws || typeof event.data !== 'string') return;
      const message = parseBinanceMessage(event.data);
      if (message) listeners.emit(message);
    };

    ws.onerror = () => {
      if (socket !== ws) return;
      emitStatus('error', 'WebSocket error');
    };

    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      const delay = backoffDelay(attempt);
      attempt += 1;
      emitStatus('connecting', `Reconnecting in ${delay / 1000} s`);
      retryTimer = setTimeout(open, delay);
    };
  }

  function disconnect() {
    if (!active) return;
    active = false;
    clearTimeout(retryTimer);
    const ws = socket;
    socket = null; // from here on, events from `ws` are ignored
    ws?.close();
    emitStatus('closed');
  }

  function connect(next: string[]) {
    disconnect();
    symbols = next;
    attempt = 0;
    active = true;
    open();
  }

  return { kind: 'binance', connect, disconnect, onMessage: listeners.on };
}
