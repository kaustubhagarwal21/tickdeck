/**
 * Web Worker that runs the simulated market off the main thread, so
 * generating hundreds of trades a second never competes with rendering.
 *
 * Protocol: the page posts one SimWorkerStart message; the worker then posts
 * batches of FeedMessage[] until the page terminates it.
 */
import { runSimulation } from '@tickdeck/core';
import type { FeedMessage, SimWorkerStart } from '@tickdeck/core';

// The project is type-checked with the DOM library, where `self` is a Window.
// Inside a worker, `self` is the worker's global scope; these are the only two
// members this file uses.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SimWorkerStart>) => void) | null;
  postMessage(batch: FeedMessage[]): void;
};

let stop: (() => void) | null = null;

worker.onmessage = (event) => {
  stop?.(); // a second start message replaces the running simulation
  const { symbols, ticksPerSecond } = event.data;
  stop = runSimulation(symbols, ticksPerSecond, (batch) => worker.postMessage(batch));
};
