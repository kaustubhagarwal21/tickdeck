import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Quote } from '@tickdeck/core';
import { useMarketStore } from '@/store/marketStore';
import { OptionChainPanel } from '../OptionChainPanel';

// Monday 12 October 2026, 09:30 IST (04:00 UTC). The weekly expiry is the next
// day, Tuesday 13 October, and the monthly one Tuesday 27 October.
const NOW = Date.UTC(2026, 9, 12, 4, 0);

function quote(symbol: string, last: number, open = last): Quote {
  return { symbol, last, open, change: last - open, changePct: 0, ts: NOW, dir: 0 };
}

/** Selects one symbol with a last price and renders the panel. */
function renderWithPrice(symbol: string, last: number) {
  useMarketStore.setState({ status: 'open', symbols: [symbol], selected: symbol, quotes: { [symbol]: quote(symbol, last) } });
  render(<OptionChainPanel />);
}

/** The ATM row, found through its row header's screen-reader text. */
function atmRow() {
  return screen.getByRole('rowheader', { name: /at the money/ }).closest('tr')!;
}

/** Cell values as numbers: "1,234.50" -> 1234.5. */
function numberIn(cell: HTMLElement) {
  return Number(cell.textContent!.replace(/[,%]/g, ''));
}

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
});

test('labels the chain as simulated and gives it table semantics', () => {
  renderWithPrice('TCS', 3107);

  const table = screen.getByRole('table', { name: /^Simulated chain: Black-Scholes with an assumed IV smile/ });
  expect(within(table).getByRole('columnheader', { name: 'Calls' })).toHaveAttribute('scope', 'colgroup');
  expect(within(table).getByRole('columnheader', { name: 'Strike' })).toHaveAttribute('scope', 'col');
  expect(within(table).getByRole('columnheader', { name: 'Puts' })).toHaveAttribute('scope', 'colgroup');
  for (const name of ['LTP', 'Delta', 'IV']) {
    expect(within(table).getAllByRole('columnheader', { name })).toHaveLength(2);
  }

  // TCS at 3,107 gets strikes 25 apart: 10 each side of the 3,100 ATM strike.
  const strikes = within(table).getAllByRole('rowheader');
  expect(strikes).toHaveLength(21);
  expect(strikes[0]).toHaveTextContent('2,850');
  expect(strikes[20]).toHaveTextContent('3,350');
  strikes.forEach((strike) => expect(strike).toHaveAttribute('scope', 'row'));
});

test('highlights the ATM strike and shades in-the-money cells', () => {
  renderWithPrice('TCS', 3107);

  expect(screen.getByRole('rowheader', { name: /at the money/ })).toHaveTextContent('3,100');
  // Calls: IV, Delta, LTP | strike | Puts: LTP, Delta, IV.
  const atmCells = within(atmRow()).getAllByRole('cell');
  // 3,100 is below spot 3,107: the call is in the money, the put is not.
  expect(atmCells.slice(0, 3).every((cell) => cell.hasAttribute('data-itm'))).toBe(true);
  expect(atmCells.slice(3).some((cell) => cell.hasAttribute('data-itm'))).toBe(false);

  // 3,125 is above spot: only the put is in the money.
  const above = within(screen.getByRole('rowheader', { name: '3,125' }).closest('tr')!).getAllByRole('cell');
  expect(above.slice(0, 3).some((cell) => cell.hasAttribute('data-itm'))).toBe(false);
  expect(above.slice(3).every((cell) => cell.hasAttribute('data-itm'))).toBe(true);

  // Delta near the money: a little over 0.5 for the ITM call, the rest for the put.
  const callDelta = numberIn(atmCells[1]);
  const putDelta = numberIn(atmCells[4]);
  expect(callDelta).toBeGreaterThan(0.5);
  expect(callDelta - putDelta).toBeCloseTo(1, 1);
});

test('switches between the weekly and monthly expiry', async () => {
  const user = userEvent.setup();
  renderWithPrice('TCS', 3107);

  expect(screen.getByRole('table', { name: /expiring Tue, 13 Oct/ })).toBeInTheDocument();
  const weeklyCall = numberIn(within(atmRow()).getAllByRole('cell')[2]);

  await user.click(screen.getByRole('radio', { name: 'Monthly' }));

  expect(screen.getByRole('table', { name: /expiring Tue, 27 Oct/ })).toBeInTheDocument();
  // More time to expiry makes the same option dearer.
  expect(numberIn(within(atmRow()).getAllByRole('cell')[2])).toBeGreaterThan(weeklyCall);
});

test('shows gamma, theta and vega on demand', async () => {
  const user = userEvent.setup();
  renderWithPrice('TCS', 3107);
  expect(screen.queryByRole('columnheader', { name: 'Gamma' })).not.toBeInTheDocument();
  expect(within(atmRow()).getAllByRole('cell')).toHaveLength(6);

  const toggle = screen.getByRole('button', { name: 'All Greeks' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await user.click(toggle);

  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Gamma', 'Theta', 'Vega']) {
    expect(screen.getAllByRole('columnheader', { name })).toHaveLength(2);
  }
  expect(within(atmRow()).getAllByRole('cell')).toHaveLength(12);
});

test('re-centres the chain when the price moves', () => {
  renderWithPrice('TCS', 3107);
  expect(screen.getByRole('rowheader', { name: /at the money/ })).toHaveTextContent('3,100');

  act(() => {
    useMarketStore.setState({ quotes: { TCS: quote('TCS', 3140, 3107) } });
  });

  expect(screen.getByRole('rowheader', { name: /at the money/ })).toHaveTextContent('3,150');
  expect(screen.getByText('3,140.00')).toBeInTheDocument(); // the spot price in the toolbar
});

test('spaces crypto strikes for the coin price', () => {
  renderWithPrice('BTCUSDT', 100_000);

  const strikes = screen.getAllByRole('rowheader');
  expect(strikes[0]).toHaveTextContent('90,000');
  expect(screen.getByRole('rowheader', { name: /at the money/ })).toHaveTextContent('100,000');
});

test('shows placeholder rows while waiting for the first price', () => {
  useMarketStore.setState({ status: 'connecting', symbols: ['TCS'], selected: 'TCS' });
  render(<OptionChainPanel />);

  expect(screen.getByText('Loading option chain…')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('says so when the feed is down and there is no price', () => {
  useMarketStore.setState({ status: 'error', symbols: ['TCS'], selected: 'TCS' });
  render(<OptionChainPanel />);

  expect(screen.getByText('Option chain unavailable')).toBeInTheDocument();
});

test('says so when no symbol is selected', () => {
  render(<OptionChainPanel />);

  expect(screen.getByText('No symbol selected')).toBeInTheDocument();
});
