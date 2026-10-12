/**
 * Batches feed items so the UI updates about 10 times a second.
 *
 * The simulation produces hundreds of trades a second. Re-rendering the
 * screen for each one would keep the JavaScript thread busy and drop frames,
 * and nobody can read prices that change that fast. So items are queued and
 * handed over together at most once every `intervalMs`.
 *
 * It is the same idea as the web app's requestAnimationFrame batcher
 * (src/lib/feed/rafBatcher.ts), with a slower, fixed timer instead of frames.
 */

/** 100 ms between flushes, so at most 10 UI updates a second. */
export const FLUSH_INTERVAL_MS = 100;

export interface Batcher<T> {
  /** Queues one item. The first push after a flush starts the timer for the next flush. */
  push(item: T): void;
  /** Stops the timer and drops queued items. Later pushes are ignored. */
  dispose(): void;
}

/**
 * Creates a batcher that calls `flush` with every item pushed since the
 * previous flush, in the order they were pushed. No timer runs while nothing
 * is queued.
 */
export function createBatcher<T>(
  flush: (items: T[]) => void,
  intervalMs: number = FLUSH_INTERVAL_MS,
): Batcher<T> {
  let queue: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function onTimer() {
    timer = null;
    const items = queue;
    queue = []; // swap first, so pushes made during flush go into the next batch
    if (items.length > 0) flush(items);
  }

  return {
    push(item) {
      if (disposed) return;
      queue.push(item);
      if (timer === null) timer = setTimeout(onTimer, intervalMs);
    },

    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
    },
  };
}
