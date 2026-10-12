import type { FeedMessage } from '@/lib/types';
import { MAX_TICKS_PER_SYMBOL, useMarketStore } from '../marketStore';

const tick = (symbol: string, price: number, ts = 1): FeedMessage => ({
  kind: 'tick',
  tick: { symbol, price, qty: 1, ts },
});
const book = (symbol: string, mid: number): FeedMessage => ({
  kind: 'book',
  book: { symbol, bids: [{ price: mid - 1, qty: 5 }], asks: [{ price: mid + 1, qty: 5 }], ts: 1 },
});

const store = () => useMarketStore.getState();
const apply = (...msgs: FeedMessage[]) => store().applyBatch(msgs);

beforeEach(() => {
  store().reset('simulated', ['TCS', 'INFY']);
});

describe('applyBatch', () => {
  it('applies a whole batch with exactly one store update', () => {
    const listener = jest.fn();
    const unsubscribe = useMarketStore.subscribe(listener);

    apply(tick('TCS', 100), tick('INFY', 50), tick('TCS', 101), book('TCS', 101), {
      kind: 'status',
      status: 'open',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store().quotes.TCS.last).toBe(101);
    expect(store().quotes.INFY.last).toBe(50);
    expect(store().books.TCS).toBeDefined();
    expect(store().status).toBe('open');
    unsubscribe();
  });

  it('does not touch the store for an empty batch', () => {
    const listener = jest.fn();
    const unsubscribe = useMarketStore.subscribe(listener);
    apply();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('measures change from the first trade, and sets the direction of each move', () => {
    apply(tick('TCS', 100, 1));
    expect(store().quotes.TCS).toEqual({
      symbol: 'TCS',
      last: 100,
      open: 100,
      change: 0,
      changePct: 0,
      ts: 1,
      dir: 0,
    });

    apply(tick('TCS', 102, 2), tick('TCS', 105, 3));
    expect(store().quotes.TCS).toEqual({
      symbol: 'TCS',
      last: 105,
      open: 100,
      change: 5,
      changePct: 5,
      ts: 3,
      dir: 1,
    });

    apply(tick('TCS', 104));
    expect(store().quotes.TCS).toMatchObject({ last: 104, change: 4, changePct: 4, dir: -1 });

    apply(tick('TCS', 104));
    expect(store().quotes.TCS.dir).toBe(0);
  });

  it('compares the direction with the previous frame, not within the batch', () => {
    apply(tick('TCS', 100));
    apply(tick('TCS', 103), tick('TCS', 101)); // fell inside the batch, but is up on the frame
    expect(store().quotes.TCS.dir).toBe(1);
  });

  it('keeps the objects of symbols without new data, so their components do not re-render', () => {
    apply(tick('TCS', 100), tick('INFY', 50), book('INFY', 50));
    const before = store();

    apply(tick('TCS', 101), book('TCS', 101));
    const after = store();

    expect(after.quotes.INFY).toBe(before.quotes.INFY);
    expect(after.books.INFY).toBe(before.books.INFY);
    expect(after.ticksBySymbol.INFY).toBe(before.ticksBySymbol.INFY);
    expect(after.quotes.TCS).not.toBe(before.quotes.TCS);
    expect(after.ticksBySymbol.TCS).not.toBe(before.ticksBySymbol.TCS);
  });

  it('appends ticks oldest first and keeps at most 5000 per symbol', () => {
    const ticks = Array.from({ length: MAX_TICKS_PER_SYMBOL + 250 }, (_, i) => tick('TCS', 100, i));

    apply(...ticks.slice(0, 3000));
    expect(store().ticksBySymbol.TCS).toHaveLength(3000);

    apply(...ticks.slice(3000));
    const kept = store().ticksBySymbol.TCS;
    expect(kept).toHaveLength(MAX_TICKS_PER_SYMBOL);
    expect(kept[0].ts).toBe(250); // the 250 oldest were dropped
    expect(kept[kept.length - 1].ts).toBe(MAX_TICKS_PER_SYMBOL + 249);
  });

  it('keeps the newest book per symbol and the newest status', () => {
    apply(book('TCS', 100), { kind: 'status', status: 'open' }, book('TCS', 200), {
      kind: 'status',
      status: 'error',
      detail: 'x',
    });
    expect(store().books.TCS.bids[0].price).toBe(199);
    expect(store().status).toBe('error');
  });
});

describe('select and reset', () => {
  it('select changes the selected symbol', () => {
    store().select('INFY');
    expect(store().selected).toBe('INFY');
  });

  it('reset clears the data and switches the feed', () => {
    apply(tick('TCS', 100), book('TCS', 100), { kind: 'status', status: 'open' });

    store().reset('binance', ['BTCUSDT', 'ETHUSDT']);

    expect(store()).toMatchObject({
      feedKind: 'binance',
      status: 'connecting',
      symbols: ['BTCUSDT', 'ETHUSDT'],
      selected: 'BTCUSDT',
      quotes: {},
      books: {},
      ticksBySymbol: {},
      metrics: { ticksIn: 0, commits: 0, lastSecondTicks: 0, lastSecondCommits: 0 },
    });
  });

  it('reset keeps the selection when the new symbol list still has it', () => {
    store().select('INFY');
    store().reset('simulated', ['TCS', 'INFY', 'SBIN']);
    expect(store().selected).toBe('INFY');
  });
});

describe('sampleMetrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    store().reset('simulated', ['TCS', 'INFY']); // starts the first sample window at fake time
  });
  afterEach(() => jest.useRealTimers());

  it('does not change the metrics on every batch, only when sampled', () => {
    const metrics = store().metrics;
    apply(tick('TCS', 100));
    expect(store().metrics).toBe(metrics);
  });

  it('publishes ticks and commits per second, plus running totals', () => {
    apply(tick('TCS', 100), tick('TCS', 101), tick('INFY', 50));
    apply(tick('TCS', 102), book('TCS', 102));
    jest.advanceTimersByTime(1000);
    store().sampleMetrics();

    expect(store().metrics).toEqual({
      ticksIn: 4,
      commits: 2,
      lastSecondTicks: 4,
      lastSecondCommits: 2,
    });

    jest.advanceTimersByTime(1000);
    store().sampleMetrics();
    expect(store().metrics).toEqual({
      ticksIn: 4,
      commits: 2,
      lastSecondTicks: 0,
      lastSecondCommits: 0,
    });
  });

  it('divides by the real time elapsed when the timer fires late', () => {
    apply(...Array.from({ length: 10 }, (_, i) => tick('TCS', 100, i)));
    jest.advanceTimersByTime(2000);
    store().sampleMetrics();
    expect(store().metrics.lastSecondTicks).toBe(5);
  });
});
