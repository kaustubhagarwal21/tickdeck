import { FLUSH_INTERVAL_MS, createBatcher } from '../batcher';

describe('createBatcher', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hands over everything pushed within one interval as one batch, in order', () => {
    const flush = jest.fn();
    const batcher = createBatcher<number>(flush);

    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    jest.advanceTimersByTime(FLUSH_INTERVAL_MS - 1);
    expect(flush).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('flushes at most once per interval however many items arrive', () => {
    const flush = jest.fn();
    const batcher = createBatcher<number>(flush);

    // 400 items over one second, like the simulation's default rate.
    for (let ms = 0; ms < 1000; ms += 25) {
      for (let i = 0; i < 10; i++) batcher.push(i);
      jest.advanceTimersByTime(25);
    }
    expect(flush).toHaveBeenCalledTimes(10);
    const total = flush.mock.calls.reduce((sum, [items]) => sum + items.length, 0);
    expect(total).toBe(400);
  });

  it('runs no timer while nothing is queued', () => {
    const flush = jest.fn();
    createBatcher<number>(flush);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 5);
    expect(flush).not.toHaveBeenCalled();
  });

  it('puts items pushed during a flush into the next batch', () => {
    const batches: number[][] = [];
    const batcher = createBatcher<number>((items) => {
      batches.push(items);
      if (items[0] === 1) batcher.push(2);
    });

    batcher.push(1);
    jest.advanceTimersByTime(FLUSH_INTERVAL_MS);
    jest.advanceTimersByTime(FLUSH_INTERVAL_MS);
    expect(batches).toEqual([[1], [2]]);
  });

  it('drops queued items on dispose and ignores later pushes', () => {
    const flush = jest.fn();
    const batcher = createBatcher<number>(flush);

    batcher.push(1);
    batcher.dispose();
    batcher.push(2);
    jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 2);
    expect(flush).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
