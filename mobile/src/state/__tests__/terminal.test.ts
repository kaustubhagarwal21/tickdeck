import { validateOrder } from '@tickdeck/core';
import type { OrderRequest, Tick } from '@tickdeck/core';
import { initialTerminalState, terminalReducer, type TerminalState } from '../terminal';

const tick = (symbol: string, price: number, ts: number): Tick => ({ symbol, price, qty: 1, ts });
const ticks = (state: TerminalState, list: Tick[]) => terminalReducer(state, { type: 'ticks', ticks: list });
const place = (state: TerminalState, req: OrderRequest, now: number) =>
  terminalReducer(state, { type: 'place', req, now });

/** A state where TCS last traded at 3100 at time 1000. */
const withPrice = () => ticks(initialTerminalState, [tick('TCS', 3100, 1000)]);

describe('terminalReducer: quotes', () => {
  it('measures change from the first trade and tracks the direction of the last move', () => {
    const state = ticks(initialTerminalState, [tick('TCS', 3100, 1), tick('TCS', 3131, 2), tick('TCS', 3124.8, 3)]);
    const quote = state.quotes.TCS;
    expect(quote.open).toBe(3100);
    expect(quote.last).toBe(3124.8);
    expect(quote.change).toBeCloseTo(24.8);
    expect(quote.changePct).toBeCloseTo(0.8);
    expect(quote.dir).toBe(-1);
  });

  it('returns the same state for an empty batch', () => {
    expect(ticks(initialTerminalState, [])).toBe(initialTerminalState);
  });
});

describe('terminalReducer: orders', () => {
  it('rejects an invalid order with the shared validateOrder message', () => {
    const req: OrderRequest = { type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 5 };
    const state = place(initialTerminalState, req, 1000); // no TCS price yet
    expect(state.orders[0]).toMatchObject({ id: 'ORD-1', status: 'REJECTED', reason: validateOrder(req) });
    expect(state.positions).toEqual({});
  });

  it('fills a market order at the next trade and opens a position', () => {
    let state = place(withPrice(), { type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 5 }, 2000);
    expect(state.orders[0].status).toBe('OPEN');

    state = ticks(state, [tick('INFY', 1520, 2001), tick('TCS', 3102, 2002)]);
    expect(state.orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 3102, filledAt: 2002 });
    expect(state.positions.TCS).toEqual({ symbol: 'TCS', qty: 5, avgPrice: 3102 });
  });

  it('does not fill on a trade that happened before the order was placed', () => {
    // The batcher can deliver a trade up to 100 ms after it happened.
    let state = place(withPrice(), { type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 5 }, 2000);
    state = ticks(state, [tick('TCS', 3101, 1950)]);
    expect(state.orders[0].status).toBe('OPEN');
  });

  it('fills a buy limit only once a trade reaches the limit, at the trade price', () => {
    let state = place(withPrice(), { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 2, price: 3090 }, 2000);
    state = ticks(state, [tick('TCS', 3095, 2001)]);
    expect(state.orders[0].status).toBe('OPEN');

    state = ticks(state, [tick('TCS', 3089.5, 2002), tick('TCS', 3080, 2003)]);
    expect(state.orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 3089.5 });
    expect(state.positions.TCS).toEqual({ symbol: 'TCS', qty: 2, avgPrice: 3089.5 });
  });

  it('triggers a sell stop-loss when the price falls to the trigger, then fills it', () => {
    let state = place(withPrice(), { type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 3 }, 2000);
    state = ticks(state, [tick('TCS', 3100, 2001)]); // long 3 @ 3100
    state = place(state, { type: 'SL', side: 'SELL', symbol: 'TCS', qty: 3, trigger: 3050, price: 3045 }, 3000);
    expect(state.orders[0].status).toBe('OPEN');

    state = ticks(state, [tick('TCS', 3049, 3001)]);
    expect(state.orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 3049 });
    expect(state.positions.TCS).toBeUndefined(); // sold all 3, so the position is flat
  });

  it('cancels a working order but leaves a filled one alone', () => {
    let state = place(withPrice(), { type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 1, price: 3200 }, 2000);
    state = terminalReducer(state, { type: 'cancel', id: 'ORD-1' });
    expect(state.orders[0].status).toBe('CANCELLED');

    // A cancelled order no longer fills.
    state = ticks(state, [tick('TCS', 3250, 2001)]);
    expect(state.orders[0].status).toBe('CANCELLED');
    expect(terminalReducer(state, { type: 'cancel', id: 'ORD-1' })).toBe(state);
  });

  it('numbers orders and lists them newest first', () => {
    let state = place(withPrice(), { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 3000 }, 2000);
    state = place(state, { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 1, price: 2900 }, 2001);
    expect(state.orders.map((o) => o.id)).toEqual(['ORD-2', 'ORD-1']);
  });
});
