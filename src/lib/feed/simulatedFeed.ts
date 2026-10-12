import type { FeedMessage, MarketFeed } from '@/lib/types';
import { createEmitter } from './emitter';
import { DEFAULT_TICKS_PER_SECOND, runSimulation, type SimWorkerStart } from './simEngine';

export interface SimulatedFeedOptions {
  /** Trades per second across all symbols. */
  ticksPerSecond?: number;
}

/**
 * A MarketFeed that streams simulated NSE prices. The simulation runs in a
 * Web Worker. Where Workers are unavailable (Jest's jsdom, or if the worker
 * script fails to load), the same simulation runs on the main thread instead.
 */
export function createSimulatedFeed({
  ticksPerSecond = DEFAULT_TICKS_PER_SECOND,
}: SimulatedFeedOptions = {}): MarketFeed {
  const listeners = createEmitter<FeedMessage>();
  let worker: Worker | null = null;
  let stopMainThread: (() => void) | null = null;

  const emitBatch = (batch: FeedMessage[]) => batch.forEach((message) => listeners.emit(message));
  const isRunning = () => worker !== null || stopMainThread !== null;

  function runOnMainThread(symbols: string[]) {
    stopMainThread = runSimulation(symbols, ticksPerSecond, emitBatch);
    listeners.emit({ kind: 'status', status: 'open', detail: 'Simulated on the main thread' });
  }

  function runInWorker(symbols: string[]) {
    // Bundlers (Turbopack, webpack) recognise this exact `new Worker(new URL(...))`
    // pattern and bundle sim.worker.ts as a separate script.
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<FeedMessage[]>) => emitBatch(event.data);
    w.onerror = () => {
      if (worker !== w) return; // an old worker that was already replaced
      // The worker script failed to load or crashed: carry on without it.
      w.terminate();
      worker = null;
      runOnMainThread(symbols);
    };
    const start: SimWorkerStart = { symbols, ticksPerSecond };
    w.postMessage(start);
    worker = w;
    listeners.emit({ kind: 'status', status: 'open', detail: 'Simulated in a Web Worker' });
  }

  function disconnect() {
    if (!isRunning()) return;
    worker?.terminate();
    worker = null;
    stopMainThread?.();
    stopMainThread = null;
    listeners.emit({ kind: 'status', status: 'closed' });
  }

  function connect(symbols: string[]) {
    disconnect();
    listeners.emit({ kind: 'status', status: 'connecting' });
    if (typeof Worker === 'undefined') runOnMainThread(symbols);
    else runInWorker(symbols);
  }

  return { kind: 'simulated', connect, disconnect, onMessage: listeners.on };
}
