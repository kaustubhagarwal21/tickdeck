import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { validateOrder } from '@tickdeck/core';
import type { Order, OrderRequest, Quote } from '@tickdeck/core';
import { useMarketStore } from '@/store/marketStore';
import { useOrderStore } from '@/store/orderStore';
import { OrderTicket } from '../OrderTicket';

// The validation rules have their own tests in packages/core/src/orders. Here
// each test decides what validateOrder returns, so these tests check only the
// ticket's part: showing the message, and not placing an invalid order. The
// rest of @tickdeck/core stays real (the spread of requireActual).
jest.mock('@tickdeck/core', () => ({
  ...jest.requireActual<typeof import('@tickdeck/core')>('@tickdeck/core'),
  validateOrder: jest.fn(),
}));
const mockValidate = jest.mocked(validateOrder);

function quote(symbol: string, last: number): Quote {
  return { symbol, last, open: last, change: 0, changePct: 0, ts: 0, dir: 0 };
}

/** Selects TCS in the real market store, with a last price unless `lastPrice` is null. */
function selectTcs(lastPrice: number | null = 3100) {
  useMarketStore.setState({
    status: 'open',
    symbols: ['TCS', 'INFY'],
    selected: 'TCS',
    quotes: lastPrice === null ? {} : { TCS: quote('TCS', lastPrice) },
  });
}

/** Swaps the real order store's placeOrder for a mock that accepts every order. */
function acceptAllOrders() {
  const placeOrder = jest.fn((req: OrderRequest) => {
    const order: Order = { id: 'ORD-1', req, status: 'OPEN', createdAt: 0 };
    return { ok: true as const, order };
  });
  useOrderStore.setState({ placeOrder });
  return placeOrder;
}

beforeEach(() => {
  // Start every test from the stores' initial state.
  useMarketStore.setState(useMarketStore.getInitialState(), true);
  useOrderStore.setState(useOrderStore.getInitialState(), true);
  mockValidate.mockReturnValue(null);
});

test('shows the price field only for limit orders, and trigger and price for stop-loss', async () => {
  const user = userEvent.setup();
  selectTcs();
  render(<OrderTicket />);

  // Market: quantity only.
  expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
  expect(screen.queryByLabelText('Limit price')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Trigger price')).not.toBeInTheDocument();

  // Limit: a limit price, which starts at the last traded price.
  await user.click(screen.getByRole('radio', { name: 'Limit' }));
  expect(screen.getByLabelText('Limit price')).toHaveValue('3100.00');
  expect(screen.queryByLabelText('Trigger price')).not.toBeInTheDocument();

  // Stop-loss: a trigger price and a limit price.
  await user.click(screen.getByRole('radio', { name: 'Stop-loss' }));
  expect(screen.getByLabelText('Trigger price')).toBeInTheDocument();
  expect(screen.getByLabelText('Limit price')).toBeInTheDocument();

  // Back to market: both price fields go away.
  await user.click(screen.getByRole('radio', { name: 'Market' }));
  expect(screen.queryByLabelText('Limit price')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Trigger price')).not.toBeInTheDocument();
});

test('shows the validation message inline and does not place the order', async () => {
  const user = userEvent.setup();
  selectTcs();
  const placeOrder = acceptAllOrders();
  mockValidate.mockReturnValue('Quantity must be a whole number greater than 0.');
  render(<OrderTicket />);

  // Nothing is flagged before the first submit.
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  await user.clear(screen.getByLabelText('Quantity'));
  await user.click(screen.getByRole('button', { name: 'Buy TCS' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Quantity must be a whole number greater than 0.');
  expect(placeOrder).not.toHaveBeenCalled();
  // The ticket validated what was on screen: an empty box is NaN, not 0.
  expect(mockValidate).toHaveBeenLastCalledWith({ type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: NaN }, 3100);

  // After that first submit, the message follows each edit, and goes away once the input is valid.
  mockValidate.mockReturnValue(null);
  await user.type(screen.getByLabelText('Quantity'), '5');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a valid order is placed and announced', async () => {
  const user = userEvent.setup();
  selectTcs();
  const placeOrder = acceptAllOrders();
  render(<OrderTicket />);

  await user.click(screen.getByRole('radio', { name: 'Sell' }));
  await user.click(screen.getByRole('radio', { name: 'Limit' }));
  await user.clear(screen.getByLabelText('Quantity'));
  await user.type(screen.getByLabelText('Quantity'), '5');
  await user.clear(screen.getByLabelText('Limit price'));
  await user.type(screen.getByLabelText('Limit price'), '3,105.5');
  await user.click(screen.getByRole('button', { name: 'Sell TCS' }));

  expect(placeOrder).toHaveBeenCalledTimes(1);
  expect(placeOrder).toHaveBeenCalledWith({ type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 5, price: 3105.5 });
  expect(screen.getByRole('status')).toHaveTextContent('Order placed: Sell 5 TCS at limit 3,105.50.');
});

test('an order the store rejects is announced with the reason', async () => {
  const user = userEvent.setup();
  selectTcs();
  useOrderStore.setState({ placeOrder: jest.fn(() => ({ ok: false as const, error: 'Trading is paused.' })) });
  render(<OrderTicket />);

  await user.click(screen.getByRole('button', { name: 'Buy TCS' }));

  expect(screen.getByRole('status')).toHaveTextContent('Order rejected: Trading is paused.');
});

test('cannot submit until the symbol has a price', () => {
  selectTcs(null);
  render(<OrderTicket />);

  expect(screen.getByRole('button', { name: 'Waiting for price…' })).toBeDisabled();
});

test('asks for a symbol when none is selected', () => {
  render(<OrderTicket />);

  expect(screen.getByText('No symbol selected')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
