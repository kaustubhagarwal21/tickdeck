import { Profiler, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import type { FeedMessage } from '@/lib/types';
import { useMarketStore } from '../marketStore';
import { useBook, useQuote, useTicks } from '../selectors';

const tick = (symbol: string, price: number): FeedMessage => ({
  kind: 'tick',
  tick: { symbol, price, qty: 1, ts: 1 },
});

function QuoteRow({ symbol }: { symbol: string }) {
  const quote = useQuote(symbol);
  return <div data-testid={symbol}>{quote ? quote.last : '-'}</div>;
}

function TickCount({ symbol }: { symbol: string }) {
  const ticks = useTicks(symbol);
  return <div data-testid={`${symbol}-ticks`}>{ticks.length}</div>;
}

function BookDepth({ symbol }: { symbol: string }) {
  const book = useBook(symbol);
  return <div data-testid={`${symbol}-book`}>{book ? book.bids.length : 0}</div>;
}

/** Wraps a subtree in React's Profiler and records its id each time it re-renders. */
function track(id: string, renders: string[], children: ReactNode) {
  return (
    <Profiler id={id} onRender={(profiledId) => renders.push(profiledId)}>
      {children}
    </Profiler>
  );
}

beforeEach(() => {
  useMarketStore.getState().reset('simulated', ['TCS', 'INFY']);
});

describe('selector hooks', () => {
  it('re-render only the components whose symbol got new data', () => {
    const renders: string[] = [];
    render(
      <>
        {track('TCS', renders, <QuoteRow symbol="TCS" />)}
        {track('INFY', renders, <QuoteRow symbol="INFY" />)}
        {track('INFY-book', renders, <BookDepth symbol="INFY" />)}
      </>,
    );
    renders.length = 0; // ignore the first render

    act(() => useMarketStore.getState().applyBatch([tick('TCS', 101), tick('TCS', 102)]));

    expect(renders).toEqual(['TCS']);
    expect(screen.getByTestId('TCS')).toHaveTextContent('102');
    expect(screen.getByTestId('INFY')).toHaveTextContent('-');
  });

  it('useTicks returns a stable empty list for a symbol without ticks, then its ticks', () => {
    const renders: string[] = [];
    render(track('ticks', renders, <TickCount symbol="TCS" />));
    renders.length = 0;

    // An update for another symbol must not re-render (a fresh [] each time would).
    act(() => useMarketStore.getState().applyBatch([tick('INFY', 50)]));
    expect(renders).toEqual([]);

    act(() => useMarketStore.getState().applyBatch([tick('TCS', 101), tick('TCS', 102)]));
    expect(screen.getByTestId('TCS-ticks')).toHaveTextContent('2');
  });
});
