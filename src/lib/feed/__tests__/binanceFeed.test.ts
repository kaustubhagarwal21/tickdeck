import type { FeedMessage, FeedStatus } from '@/lib/types';
import {
  backoffDelay,
  binanceStreamUrl,
  createBinanceFeed,
  parseBinanceMessage,
} from '../binanceFeed';

const tradeJson = (price: string, symbol = 'BTCUSDT') =>
  JSON.stringify({
    stream: `${symbol.toLowerCase()}@trade`,
    data: { e: 'trade', E: 1, s: symbol, t: 12345, p: price, q: '0.0015', T: 1700000000123, m: true, M: true },
  });

describe('binanceStreamUrl', () => {
  it('builds one combined stream with trades and top-10 depth for each symbol, in lower case', () => {
    expect(binanceStreamUrl(['BTCUSDT', 'ETHUSDT'])).toBe(
      'wss://stream.binance.com:9443/stream?streams=' +
        'btcusdt@trade/btcusdt@depth10@100ms/ethusdt@trade/ethusdt@depth10@100ms',
    );
  });
});

describe('backoffDelay', () => {
  it('doubles from 1 s and is capped at 15 s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 15000, 15000, 15000,
    ]);
  });
});

describe('parseBinanceMessage', () => {
  it('parses a trade, converting the string price and quantity to numbers', () => {
    expect(parseBinanceMessage(tradeJson('64250.10'))).toEqual({
      kind: 'tick',
      tick: { symbol: 'BTCUSDT', price: 64250.1, qty: 0.0015, ts: 1700000000123 },
    });
  });

  it('parses a depth snapshot, taking the symbol from the stream name', () => {
    const raw = JSON.stringify({
      stream: 'ethusdt@depth10@100ms',
      data: {
        lastUpdateId: 160,
        bids: [['3000.10', '1.5'], ['3000.00', '2']],
        asks: [['3000.20', '0.5']],
      },
    });

    expect(parseBinanceMessage(raw, 42)).toEqual({
      kind: 'book',
      book: {
        symbol: 'ETHUSDT',
        bids: [{ price: 3000.1, qty: 1.5 }, { price: 3000, qty: 2 }],
        asks: [{ price: 3000.2, qty: 0.5 }],
        ts: 42,
      },
    });
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a message without the stream envelope', JSON.stringify({ e: 'trade', s: 'BTCUSDT' })],
    ['an event type it does not use', JSON.stringify({ stream: 'btcusdt@kline_1m', data: { e: 'kline' } })],
    ['a trade whose price is not a number', tradeJson('abc')],
    [
      'a trade whose price is not a string',
      JSON.stringify({ stream: 'btcusdt@trade', data: { e: 'trade', s: 'BTCUSDT', p: 1, q: '1', T: 1 } }),
    ],
    [
      'depth with malformed levels',
      JSON.stringify({ stream: 'btcusdt@depth10@100ms', data: { bids: [[1, 2]], asks: [] } }),
    ],
  ])('returns null for %s', (_label, raw) => {
    expect(parseBinanceMessage(raw)).toBeNull();
  });
});

/**
 * Stands in for the browser's WebSocket. Tests drive it with open(),
 * receive() and fail() to act as the Binance server.
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.(new Event('open'));
  }

  receive(data: string | ArrayBuffer) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  /** A failed connection: browsers fire `error` and then `close`. */
  fail() {
    this.onerror?.(new Event('error'));
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('createBinanceFeed', () => {
  const realWebSocket = globalThis.WebSocket;
  const latestSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

  let messages: FeedMessage[];
  const statuses = () =>
    messages.flatMap((m) => (m.kind === 'status' ? [[m.status, m.detail] as const] : []));

  function connectFeed(symbols = ['BTCUSDT']) {
    const feed = createBinanceFeed();
    feed.onMessage((m) => messages.push(m));
    feed.connect(symbols);
    return feed;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    messages = [];
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = realWebSocket;
    jest.useRealTimers();
  });

  it('opens the combined stream and emits parsed trades', () => {
    const feed = connectFeed(['BTCUSDT', 'ETHUSDT']);
    const socket = latestSocket();
    expect(socket.url).toBe(binanceStreamUrl(['BTCUSDT', 'ETHUSDT']));

    socket.open();
    socket.receive(tradeJson('64000.5'));

    expect(statuses().map(([status]) => status)).toEqual<FeedStatus[]>(['connecting', 'open']);
    expect(messages).toContainEqual({
      kind: 'tick',
      tick: { symbol: 'BTCUSDT', price: 64000.5, qty: 0.0015, ts: 1700000000123 },
    });
    feed.disconnect();
  });

  it('ignores binary frames and messages it does not recognise', () => {
    const feed = connectFeed();
    latestSocket().receive(new ArrayBuffer(8));
    latestSocket().receive('{"result":null,"id":1}');

    expect(messages.filter((m) => m.kind !== 'status')).toEqual([]);
    feed.disconnect();
  });

  it('reports an error, then reconnects after 1 s, 2 s, 4 s, 8 s, 15 s, 15 s', () => {
    const feed = connectFeed();

    for (const delay of [1000, 2000, 4000, 8000, 15000, 15000]) {
      const socketsBefore = FakeWebSocket.instances.length;
      latestSocket().fail();
      expect(statuses().slice(-2)).toEqual([
        ['error', 'WebSocket error'],
        ['connecting', `Reconnecting in ${delay / 1000} s`],
      ]);

      jest.advanceTimersByTime(delay - 1);
      expect(FakeWebSocket.instances).toHaveLength(socketsBefore); // not yet
      jest.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(socketsBefore + 1); // reconnected
    }
    feed.disconnect();
  });

  it('resets the wait to 1 s after a successful connection', () => {
    const feed = connectFeed();
    latestSocket().fail();
    jest.advanceTimersByTime(1000);
    latestSocket().fail();
    jest.advanceTimersByTime(2000);

    latestSocket().open(); // connected again
    latestSocket().fail();

    expect(statuses().at(-1)).toEqual(['connecting', 'Reconnecting in 1 s']);
    feed.disconnect();
  });

  it('on disconnect closes the socket, reports closed, and stops reconnecting', () => {
    const feed = connectFeed();
    const socket = latestSocket();
    socket.open();

    feed.disconnect();
    socket.fail(); // late events from the closed socket are ignored
    socket.receive(tradeJson('1'));
    jest.advanceTimersByTime(60_000);

    expect(socket.closed).toBe(true);
    expect(statuses().at(-1)).toEqual(['closed', undefined]);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(messages.some((m) => m.kind === 'tick')).toBe(false);
  });

  it('cancels a pending reconnect on disconnect', () => {
    const feed = connectFeed();
    latestSocket().fail(); // a reconnect is now scheduled

    feed.disconnect();
    jest.advanceTimersByTime(60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('is of kind "binance"', () => {
    expect(createBinanceFeed().kind).toBe('binance');
  });
});
