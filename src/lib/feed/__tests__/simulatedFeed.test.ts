import type { FeedMessage } from '@tickdeck/core';
import { createSimulatedFeed } from '../simulatedFeed';

const statusesOf = (messages: FeedMessage[]) =>
  messages.flatMap((m) => (m.kind === 'status' ? [m.status] : []));

describe('createSimulatedFeed on the main thread (no Worker, as in jsdom)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports connecting and open, then streams trades and books for the given symbols', () => {
    const feed = createSimulatedFeed({ ticksPerSecond: 200 });
    const messages: FeedMessage[] = [];
    feed.onMessage((m) => messages.push(m));

    feed.connect(['TCS', 'INFY']);
    expect(messages).toEqual([
      { kind: 'status', status: 'connecting' },
      { kind: 'status', status: 'open', detail: 'Simulated on the main thread' },
    ]);

    jest.advanceTimersByTime(1000);
    const ticks = messages.flatMap((m) => (m.kind === 'tick' ? [m.tick] : []));
    const books = messages.flatMap((m) => (m.kind === 'book' ? [m.book] : []));
    expect(ticks).toHaveLength(200);
    expect(new Set(ticks.map((t) => t.symbol))).toEqual(new Set(['TCS', 'INFY']));
    expect(books).toHaveLength(2 * 10); // 2 symbols, every 100 ms

    feed.disconnect();
  });

  it('stops streaming and reports closed on disconnect', () => {
    const feed = createSimulatedFeed();
    const messages: FeedMessage[] = [];
    feed.onMessage((m) => messages.push(m));
    feed.connect(['SBIN']);
    jest.advanceTimersByTime(100);

    feed.disconnect();
    const count = messages.length;
    jest.advanceTimersByTime(1000);

    expect(messages).toHaveLength(count);
    expect(statusesOf(messages).at(-1)).toBe('closed');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops calling a listener once it unsubscribes', () => {
    const feed = createSimulatedFeed();
    const listener = jest.fn();
    const unsubscribe = feed.onMessage(listener);
    feed.connect(['SBIN']);
    unsubscribe();
    listener.mockClear();

    jest.advanceTimersByTime(500);

    expect(listener).not.toHaveBeenCalled();
    feed.disconnect();
  });

  it('is of kind "simulated"', () => {
    expect(createSimulatedFeed().kind).toBe('simulated');
  });
});

/** Stands in for the browser's Worker so the test can see what the feed does with it. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<FeedMessage[]>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  constructor(
    public url: URL,
    public options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  terminate() {
    this.terminated = true;
  }
}

describe('createSimulatedFeed with a Web Worker', () => {
  const globals = globalThis as { Worker?: unknown };

  beforeEach(() => {
    FakeWorker.instances = [];
    globals.Worker = FakeWorker;
  });

  afterEach(() => {
    delete globals.Worker;
    jest.useRealTimers();
  });

  it('starts sim.worker.ts with the symbols and rate, and re-emits its batches', () => {
    const feed = createSimulatedFeed({ ticksPerSecond: 50 });
    const messages: FeedMessage[] = [];
    feed.onMessage((m) => messages.push(m));

    feed.connect(['SBIN']);

    const worker = FakeWorker.instances[0];
    expect(worker.url.href).toMatch(/sim\.worker\.ts$/);
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.posted).toEqual([{ symbols: ['SBIN'], ticksPerSecond: 50 }]);
    expect(statusesOf(messages)).toEqual(['connecting', 'open']);

    const batch: FeedMessage[] = [
      { kind: 'tick', tick: { symbol: 'SBIN', price: 820.05, qty: 3, ts: 1 } },
      { kind: 'tick', tick: { symbol: 'SBIN', price: 820.1, qty: 7, ts: 2 } },
    ];
    worker.onmessage?.(new MessageEvent('message', { data: batch }));
    expect(messages.slice(-2)).toEqual(batch);

    feed.disconnect();
    expect(worker.terminated).toBe(true);
    expect(statusesOf(messages).at(-1)).toBe('closed');
  });

  it('runs the simulation on the main thread if the worker fails to load', () => {
    jest.useFakeTimers();
    const feed = createSimulatedFeed();
    const messages: FeedMessage[] = [];
    feed.onMessage((m) => messages.push(m));
    feed.connect(['SBIN']);
    const worker = FakeWorker.instances[0];

    worker.onerror?.(new Event('error'));
    jest.advanceTimersByTime(100);

    expect(worker.terminated).toBe(true);
    expect(messages).toContainEqual({
      kind: 'status',
      status: 'open',
      detail: 'Simulated on the main thread',
    });
    expect(messages.some((m) => m.kind === 'tick')).toBe(true);
    feed.disconnect();
  });
});
