import { render, screen, within } from '@testing-library/react';
import type { BookSnapshot } from '@/lib/types';
import { useMarketStore } from '@/store/marketStore';
import { OrderBook } from '../OrderBook';

/** The rows of one side of the book ("Asks" or "Bids"), top to bottom. */
function rowsOf(side: 'Asks' | 'Bids') {
  return within(screen.getByRole('rowgroup', { name: side })).getAllByRole('row');
}

/** The text of every cell in a row: price, quantity, running total. */
function cells(row: HTMLElement) {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
});

test('shows asks above bids, best prices next to the spread, with running totals', () => {
  const book: BookSnapshot = {
    symbol: 'TCS',
    // Out of order on purpose: the panel sorts each side itself.
    bids: [
      { price: 3099, qty: 5 },
      { price: 3099.5, qty: 2 },
    ],
    asks: [
      { price: 3101, qty: 4 },
      { price: 3100.5, qty: 1 },
    ],
    ts: 0,
  };
  useMarketStore.setState({ status: 'open', symbols: ['TCS'], selected: 'TCS', books: { TCS: book } });
  render(<OrderBook />);

  // Asks: highest at the top, so the best ask (3,100.50) sits just above the spread.
  expect(rowsOf('Asks').map(cells)).toEqual([
    ['3,101.00', '4', '5'],
    ['3,100.50', '1', '1'],
  ]);
  // Bids: the best bid (3,099.50) sits just below the spread.
  expect(rowsOf('Bids').map(cells)).toEqual([
    ['3,099.50', '2', '2'],
    ['3,099.00', '5', '7'],
  ]);

  // 3,100.50 - 3,099.50 = 1.00, which is 0.032% of the 3,100 mid price.
  expect(screen.getByRole('cell', { name: /^Spread/ })).toHaveTextContent('Spread 1.00 (0.032%)');

  // The deepest level (running total 7) has a full-width depth bar.
  const deepestBar = rowsOf('Bids')[1].querySelector('[aria-hidden="true"]');
  expect(deepestBar).toHaveStyle({ transform: 'scaleX(1)' });
});

test('shows placeholder rows while waiting for the first snapshot', () => {
  useMarketStore.setState({ status: 'connecting', symbols: ['TCS'], selected: 'TCS' });
  render(<OrderBook />);

  expect(screen.getByText('Loading order book…')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('says so when no symbol is selected', () => {
  render(<OrderBook />);

  expect(screen.getByText('No symbol selected')).toBeInTheDocument();
});
