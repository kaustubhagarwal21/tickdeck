import { useCallback, useEffect, useReducer } from 'react';
import { DEFAULT_TICKS_PER_SECOND, SIM_SYMBOLS, runSimulation } from '@tickdeck/core';
import type { OrderRequest, Tick } from '@tickdeck/core';
import { createBatcher } from '../market/batcher';
import { initialTerminalState, terminalReducer } from './terminal';

/**
 * Runs the shared simulated market (the same engine as the web app) and keeps
 * the terminal state. Trades are batched, so the reducer and the re-render
 * run about 10 times a second, not hundreds.
 */
export function useTerminal() {
  const [state, dispatch] = useReducer(terminalReducer, initialTerminalState);

  useEffect(() => {
    const batcher = createBatcher<Tick>((ticks) => dispatch({ type: 'ticks', ticks }));
    // runSimulation runs on setInterval and also sends order books; this app
    // shows trades only, so it keeps the tick messages.
    const stop = runSimulation(SIM_SYMBOLS, DEFAULT_TICKS_PER_SECOND, (batch) => {
      for (const msg of batch) {
        if (msg.kind === 'tick') batcher.push(msg.tick);
      }
    });
    return () => {
      stop();
      batcher.dispose();
    };
  }, []);

  const placeOrder = useCallback((req: OrderRequest) => dispatch({ type: 'place', req, now: Date.now() }), []);
  const cancelOrder = useCallback((id: string) => dispatch({ type: 'cancel', id }), []);

  return { state, placeOrder, cancelOrder };
}
