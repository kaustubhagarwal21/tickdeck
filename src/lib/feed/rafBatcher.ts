/**
 * Frame batching: the main performance idea in TickDeck.
 *
 * A busy feed delivers hundreds of messages a second. If each one updated the
 * store, React would re-render hundreds of times a second, far more often than
 * the screen can repaint (about 60 times a second). Instead, messages are
 * queued and handed over together once per animation frame, so the store is
 * updated at most about 60 times a second however fast the data arrives.
 */

export interface RafBatcher<T> {
  /** Queues one item. The first push after a flush schedules the next flush. */
  push(item: T): void;
  /** Cancels the pending flush and drops queued items. Later pushes are ignored. */
  dispose(): void;
}

/** Flush right away once this many items are queued (see the note in push). */
export const DEFAULT_MAX_QUEUE = 5000;

/**
 * Creates a batcher that calls `flush` at most once per frame with every item
 * pushed since the previous flush, in the order they were pushed.
 *
 * `schedule` and `cancel` default to the browser's requestAnimationFrame and
 * cancelAnimationFrame. Tests pass fake versions to control when frames happen.
 */
export function createRafBatcher<T>(
  flush: (items: T[]) => void,
  schedule: (callback: () => void) => number = requestAnimationFrame,
  cancel: (handle: number) => void = cancelAnimationFrame,
  maxQueue: number = DEFAULT_MAX_QUEUE,
): RafBatcher<T> {
  let queue: T[] = [];
  let frame: number | null = null; // handle of the scheduled frame, if any
  let disposed = false;

  function flushQueue() {
    const items = queue;
    queue = []; // swap before flushing, so pushes made during flush start a new batch
    if (items.length > 0) flush(items);
  }

  function onFrame() {
    frame = null;
    flushQueue();
  }

  return {
    push(item) {
      if (disposed) return;
      queue.push(item);
      if (queue.length >= maxQueue) {
        // Safety valve: browsers pause requestAnimationFrame in background tabs,
        // so without this the queue would keep growing while the tab is hidden.
        if (frame !== null) cancel(frame);
        frame = null;
        flushQueue();
      } else if (frame === null) {
        frame = schedule(onFrame);
      }
    },

    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
      queue = [];
    },
  };
}
