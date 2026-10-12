import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Quote } from '@/lib/types';
import { useMarketStore } from '@/store/marketStore';
import { useQuote } from '@/store/selectors';
import { Watchlist } from '../Watchlist';

// The real selector hooks, with useQuote wrapped in a spy. Every render of a
// watchlist row calls useQuote once, so the spy shows which rows re-rendered.
jest.mock('@/store/selectors', () => {
  const actual = jest.requireActual<typeof import('@/store/selectors')>('@/store/selectors');
  return { ...actual, useQuote: jest.fn(actual.useQuote) };
});

function quote(symbol: string, last: number, dir: Quote['dir'] = 0, open = last): Quote {
  const change = last - open;
  return { symbol, last, open, change, changePct: (change / open) * 100, ts: 0, dir };
}

/** Puts a new quote for one symbol into the real market store, as a trade would. */
function trade(symbol: string, last: number, dir: Quote['dir']) {
  act(() => {
    useMarketStore.setState((s) => ({ quotes: { ...s.quotes, [symbol]: quote(symbol, last, dir) } }));
  });
}

/** A watchlist row, found by the symbol it starts with. */
const row = (symbol: string) => screen.getByRole('option', { name: new RegExp(`^${symbol}\\b`) });

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
  useMarketStore.setState({
    feedKind: 'simulated',
    status: 'open',
    symbols: ['RELIANCE', 'TCS', 'INFY'],
    selected: 'RELIANCE',
    quotes: {
      RELIANCE: quote('RELIANCE', 1450),
      TCS: quote('TCS', 3100),
      INFY: quote('INFY', 1520),
    },
  });
});

test('arrow keys move the highlight and Enter selects', async () => {
  const user = userEvent.setup();
  render(<Watchlist />);
  const list = screen.getByRole('listbox', { name: 'Watchlist' });

  expect(row('RELIANCE')).toHaveAttribute('aria-selected', 'true');

  await user.tab();
  expect(list).toHaveFocus();
  expect(list).toHaveAttribute('aria-activedescendant', row('RELIANCE').id);

  await user.keyboard('{ArrowDown}');
  expect(list).toHaveAttribute('aria-activedescendant', row('TCS').id);
  // Moving only highlights: the selection has not changed yet.
  expect(useMarketStore.getState().selected).toBe('RELIANCE');

  await user.keyboard('{Enter}');
  expect(useMarketStore.getState().selected).toBe('TCS');
  expect(row('TCS')).toHaveAttribute('aria-selected', 'true');
  expect(row('RELIANCE')).toHaveAttribute('aria-selected', 'false');

  // End jumps to the last row, ArrowDown stops there, and Space selects too.
  await user.keyboard('{End}{ArrowDown} ');
  expect(useMarketStore.getState().selected).toBe('INFY');

  // Home goes back to the first row.
  await user.keyboard('{Home}{Enter}');
  expect(useMarketStore.getState().selected).toBe('RELIANCE');
});

test('clicking a row selects it', async () => {
  const user = userEvent.setup();
  render(<Watchlist />);

  await user.click(row('INFY'));

  expect(useMarketStore.getState().selected).toBe('INFY');
  expect(row('INFY')).toHaveAttribute('aria-selected', 'true');
});

test('a trade re-renders only the row of its own symbol', () => {
  render(<Watchlist />);
  const useQuoteSpy = jest.mocked(useQuote);
  useQuoteSpy.mockClear();

  trade('TCS', 3101, 1);

  // Only the TCS row called its hook again, so only the TCS row re-rendered.
  expect(useQuoteSpy.mock.calls.map(([symbol]) => symbol)).toEqual(['TCS']);
  expect(row('TCS')).toHaveTextContent('3,101.00');
});

test('a price move flashes, and a trade at the same price does not restart the flash', () => {
  render(<Watchlist />);

  trade('TCS', 3101, 1);
  const flash = row('TCS').querySelector('.flash-up');
  expect(flash).not.toBeNull();

  // Same price, direction 0: the very same element stays, so its animation runs on.
  trade('TCS', 3101, 0);
  expect(row('TCS').querySelector('.flash-up')).toBe(flash);

  trade('TCS', 3099, -1);
  expect(row('TCS').querySelector('.flash-down')).not.toBeNull();
});

test('labels simulated prices as simulated', () => {
  render(<Watchlist />);

  expect(screen.getByText('Simulated')).toBeInTheDocument();
});

test('shows placeholders until the feed has sent its symbols', () => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
  render(<Watchlist />);

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByText('Loading prices…')).toBeInTheDocument();
});
