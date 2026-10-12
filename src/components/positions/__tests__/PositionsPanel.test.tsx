import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Order, Quote } from '@/lib/types';
import { useMarketStore } from '@/store/marketStore';
import { useOrderStore } from '@/store/orderStore';
import { PositionsPanel } from '../PositionsPanel';

function quote(symbol: string, last: number): Quote {
  return { symbol, last, open: last, change: 0, changePct: 0, ts: 0, dir: 0 };
}

const openLimit: Order = {
  id: 'ORD-2',
  req: { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 10, price: 3000 },
  status: 'OPEN',
  createdAt: 0,
};

const filledMarket: Order = {
  id: 'ORD-1',
  req: { type: 'MARKET', side: 'SELL', symbol: 'INFY', qty: 5 },
  status: 'FILLED',
  createdAt: 0,
  filledAt: 0,
  fillPrice: 1500,
};

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
  useOrderStore.setState(useOrderStore.getInitialState(), true);
});

test('shows an empty state when there are no positions', () => {
  render(<PositionsPanel />);

  expect(screen.getByRole('tab', { name: /positions/i })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('No positions yet')).toBeInTheDocument();
});

test('shows live P&L for long and short positions', () => {
  useOrderStore.setState({
    positions: {
      TCS: { symbol: 'TCS', qty: 10, avgPrice: 3000 },
      INFY: { symbol: 'INFY', qty: -5, avgPrice: 1500 },
    },
  });
  useMarketStore.setState({ quotes: { TCS: quote('TCS', 3100), INFY: quote('INFY', 1520) } });
  render(<PositionsPanel />);

  // Long 10 TCS bought at 3,000, now 3,100: (3,100 - 3,000) x 10.
  expect(screen.getByRole('row', { name: /^TCS/ })).toHaveTextContent('+₹1,000.00');
  // Short 5 INFY sold at 1,500, now 1,520: the price rose, so the short loses.
  expect(screen.getByRole('row', { name: /^INFY/ })).toHaveTextContent('-₹100.00');

  // The P&L follows the live price.
  act(() => {
    useMarketStore.setState((s) => ({ quotes: { ...s.quotes, TCS: quote('TCS', 2990) } }));
  });
  expect(screen.getByRole('row', { name: /^TCS/ })).toHaveTextContent('-₹100.00');
});

test('lists open orders with a cancel button, and finished orders below', async () => {
  const user = userEvent.setup();
  const cancelOrder = jest.fn();
  useOrderStore.setState({ orders: [openLimit, filledMarket], cancelOrder });
  render(<PositionsPanel />);

  await user.click(screen.getByRole('tab', { name: /orders/i }));
  await user.click(screen.getByRole('button', { name: 'Cancel order: Buy 10 TCS at limit 3,000.00' }));

  expect(cancelOrder).toHaveBeenCalledWith('ORD-2');
  expect(screen.getByRole('table', { name: 'Order history' })).toHaveTextContent('Filled');
  // Finished orders cannot be cancelled.
  expect(screen.getAllByRole('button', { name: /^Cancel order/ })).toHaveLength(1);
});

test('shows "No open orders" when nothing is waiting to fill', async () => {
  const user = userEvent.setup();
  render(<PositionsPanel />);

  await user.click(screen.getByRole('tab', { name: /orders/i }));

  expect(screen.getByText('No open orders')).toBeInTheDocument();
});

test('arrow keys switch between the tabs', async () => {
  const user = userEvent.setup();
  render(<PositionsPanel />);

  await user.tab(); // focuses the selected tab
  await user.keyboard('{ArrowRight}');

  const ordersTab = screen.getByRole('tab', { name: /orders/i });
  expect(ordersTab).toHaveAttribute('aria-selected', 'true');
  expect(ordersTab).toHaveFocus();
});
