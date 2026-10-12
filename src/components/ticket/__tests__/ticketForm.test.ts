import { changeOrderType, parseAmount, toOrderRequest, type TicketForm } from '../ticketForm';

describe('toOrderRequest', () => {
  test('builds a market order with only a quantity', () => {
    expect(toOrderRequest({ type: 'MARKET', qty: '10' }, 'BUY', 'TCS')).toEqual({
      type: 'MARKET',
      side: 'BUY',
      symbol: 'TCS',
      qty: 10,
    });
  });

  test('builds a limit order with its price', () => {
    expect(toOrderRequest({ type: 'LIMIT', qty: '5', price: '3,100.50' }, 'SELL', 'TCS')).toEqual({
      type: 'LIMIT',
      side: 'SELL',
      symbol: 'TCS',
      qty: 5,
      price: 3100.5,
    });
  });

  test('builds a stop-loss order with its trigger and price', () => {
    expect(toOrderRequest({ type: 'SL', qty: '5', trigger: '3095', price: '3090' }, 'SELL', 'TCS')).toEqual({
      type: 'SL',
      side: 'SELL',
      symbol: 'TCS',
      qty: 5,
      trigger: 3095,
      price: 3090,
    });
  });
});

test('parseAmount reads numbers as people type them and turns anything else into NaN', () => {
  expect(parseAmount('1,450.50')).toBe(1450.5);
  expect(parseAmount(' 10 ')).toBe(10);
  expect(parseAmount('.5')).toBe(0.5);
  expect(parseAmount('')).toBeNaN();
  expect(parseAmount('abc')).toBeNaN();
  expect(parseAmount('-5')).toBeNaN();
  expect(parseAmount('1e3')).toBeNaN();
});

describe('changeOrderType', () => {
  test('starts a new price field at the price it is given', () => {
    expect(changeOrderType({ type: 'MARKET', qty: '3' }, 'LIMIT', '3100.00')).toEqual({
      type: 'LIMIT',
      qty: '3',
      price: '3100.00',
    });
  });

  test('keeps what the user already typed', () => {
    const limit: TicketForm = { type: 'LIMIT', qty: '3', price: '3090' };
    const stopLoss = changeOrderType(limit, 'SL', '3100.00');

    expect(stopLoss).toEqual({ type: 'SL', qty: '3', price: '3090', trigger: '3090' });
    expect(changeOrderType(stopLoss, 'MARKET', '3100.00')).toEqual({ type: 'MARKET', qty: '3' });
  });
});
