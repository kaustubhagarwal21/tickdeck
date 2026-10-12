import { act, render, screen } from '@testing-library/react';
import { BINANCE_SYMBOLS, SIM_SYMBOLS } from '@/lib/symbols';
import { useMarketStore } from '@/store/marketStore';
import { useOrderStore } from '@/store/orderStore';
import { BINANCE_FIRST_DATA_TIMEOUT_MS, FeedProvider } from '../FeedProvider';

// The query string the mocked useSearchParams() returns; null means "no router".
let mockQuery: string | null = 'feed=sim';
jest.mock('next/navigation', () => ({
  useSearchParams: () => (mockQuery === null ? null : new URLSearchParams(mockQuery)),
}));

/** Stands in for the browser's WebSocket, so no test touches the network. */
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

  sendTrade(price: number) {
    const data = { e: 'trade', s: 'BTCUSDT', p: String(price), q: '0.01', T: Date.now() };
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ stream: 'btcusdt@trade', data }) }));
  }

  fail() {
    this.onerror?.(new Event('error'));
    this.onclose?.(new CloseEvent('close'));
  }
}

const realWebSocket = globalThis.WebSocket;
const market = () => useMarketStore.getState();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const renderProvider = () => render(<FeedProvider>dashboard</FeedProvider>);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  useOrderStore.setState({ orders: [], positions: {} });
});

afterEach(() => {
  globalThis.WebSocket = realWebSocket;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FeedProvider with ?feed=sim', () => {
  beforeEach(() => {
    mockQuery = 'feed=sim';
  });

  it('renders its children', () => {
    renderProvider();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('streams simulated data into the market store', () => {
    renderProvider();
    expect(market()).toMatchObject({ feedKind: 'simulated', symbols: SIM_SYMBOLS, selected: 'RELIANCE' });

    advance(200);

    expect(market().status).toBe('open');
    expect(Object.keys(market().quotes).sort()).toEqual([...SIM_SYMBOLS].sort());
    expect(Object.keys(market().books).sort()).toEqual([...SIM_SYMBOLS].sort());
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('turns 400 ticks a second into at most one store commit per frame', () => {
    renderProvider();

    advance(2000); // FeedProvider samples the metrics every second

    const { lastSecondTicks, lastSecondCommits } = market().metrics;
    expect(lastSecondTicks).toBe(400);
    expect(lastSecondCommits).toBeGreaterThan(0);
    expect(lastSecondCommits).toBeLessThanOrEqual(63); // one per 16 ms frame at most
  });

  it('reads the trade rate from ?rate=', () => {
    mockQuery = 'feed=sim&rate=100';
    renderProvider();
    advance(2000);
    expect(market().metrics.lastSecondTicks).toBe(100);
  });

  it('passes every tick to the order store, so orders fill', () => {
    renderProvider();
    advance(200);

    const result = useOrderStore
      .getState()
      .placeOrder({ type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 1 });
    expect(result.ok).toBe(true);

    advance(1000);
    expect(useOrderStore.getState().orders[0].status).toBe('FILLED');
  });

  it('stops everything on unmount', () => {
    const { unmount } = renderProvider();
    advance(200);

    unmount();
    const quotes = market().quotes;
    advance(2000);

    expect(market().quotes).toBe(quotes); // no more updates
    expect(jest.getTimerCount()).toBe(0); // feed timers, frame and metrics timer all cleared
  });
});

describe('FeedProvider with Binance (the default)', () => {
  beforeEach(() => {
    mockQuery = '';
  });

  it('streams Binance and keeps it once data arrives', () => {
    renderProvider();
    const socket = FakeWebSocket.instances[0];
    expect(market()).toMatchObject({ feedKind: 'binance', symbols: BINANCE_SYMBOLS });
    expect(socket.url).toContain('btcusdt@trade');

    act(() => {
      socket.open();
      socket.sendTrade(64000.5);
    });
    advance(16); // one frame

    expect(market().quotes.BTCUSDT.last).toBe(64000.5);

    // A later outage is left to the feed's own reconnect: no fallback.
    act(() => socket.fail());
    advance(BINANCE_FIRST_DATA_TIMEOUT_MS * 2);
    expect(market().feedKind).toBe('binance');
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1); // it reconnected
  });

  it('falls back to the simulated feed when the socket fails before any data', () => {
    renderProvider();
    const socket = FakeWebSocket.instances[0];

    act(() => socket.fail());

    expect(market()).toMatchObject({ feedKind: 'simulated', symbols: SIM_SYMBOLS });
    advance(200);
    expect(Object.keys(market().quotes)).toHaveLength(SIM_SYMBOLS.length);
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/Binance feed unavailable/));

    advance(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1); // the Binance feed stopped retrying
  });

  it('falls back when Binance sends no data within 5 s', () => {
    renderProvider();
    act(() => FakeWebSocket.instances[0].open()); // connected, but silent

    advance(BINANCE_FIRST_DATA_TIMEOUT_MS - 1);
    expect(market().feedKind).toBe('binance');

    advance(1);
    expect(market().feedKind).toBe('simulated');
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });
});

describe('FeedProvider switching feeds', () => {
  it('closes the old feed and starts the new one when the URL changes', () => {
    mockQuery = '';
    const { rerender } = renderProvider();
    const socket = FakeWebSocket.instances[0];

    mockQuery = 'feed=sim';
    rerender(<FeedProvider>dashboard</FeedProvider>);

    expect(socket.closed).toBe(true);
    expect(market().feedKind).toBe('simulated');
    advance(BINANCE_FIRST_DATA_TIMEOUT_MS * 2);
    expect(console.info).not.toHaveBeenCalled(); // the old feed's 5 s check was cleared
  });

  it('tries Binance again after a fallback when the URL asks for it', () => {
    mockQuery = '';
    const { rerender } = renderProvider();
    act(() => FakeWebSocket.instances[0].fail());
    expect(market().feedKind).toBe('simulated');

    mockQuery = 'feed=sim';
    rerender(<FeedProvider>dashboard</FeedProvider>);
    mockQuery = 'feed=binance';
    rerender(<FeedProvider>dashboard</FeedProvider>);

    expect(market().feedKind).toBe('binance');
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('uses the simulated feed when there is no router to read the URL from', () => {
    mockQuery = null;
    renderProvider();
    expect(market().feedKind).toBe('simulated');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
