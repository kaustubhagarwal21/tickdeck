import { validateOrder } from '@tickdeck/core';
import { initialOrderForm, toOrderRequest } from '../orderForm';

describe('toOrderRequest', () => {
  it('builds each order type from the typed text', () => {
    expect(toOrderRequest({ ...initialOrderForm, qty: '10' }, 'SBIN')).toEqual({
      type: 'MARKET',
      side: 'BUY',
      symbol: 'SBIN',
      qty: 10,
    });
    expect(toOrderRequest({ ...initialOrderForm, type: 'LIMIT', side: 'SELL', qty: '2', price: '821.5' }, 'SBIN')).toEqual(
      { type: 'LIMIT', side: 'SELL', symbol: 'SBIN', qty: 2, price: 821.5 },
    );
    expect(
      toOrderRequest({ ...initialOrderForm, type: 'SL', qty: '1', trigger: '830', price: '831' }, 'SBIN'),
    ).toEqual({ type: 'SL', side: 'BUY', symbol: 'SBIN', qty: 1, trigger: 830, price: 831 });
  });

  it('lets the shared validateOrder report empty or bad input', () => {
    const noQty = toOrderRequest({ ...initialOrderForm, qty: '' }, 'SBIN');
    expect(validateOrder(noQty, 820)).toBe('Quantity must be a whole number greater than 0.');

    const noPrice = toOrderRequest({ ...initialOrderForm, type: 'LIMIT', price: '' }, 'SBIN');
    expect(validateOrder(noPrice, 820)).toBe('Limit price must be greater than 0.');

    const badStop = toOrderRequest({ ...initialOrderForm, type: 'SL', trigger: '810', price: '815' }, 'SBIN');
    expect(validateOrder(badStop, 820)).toBe('For a buy stop-loss, the trigger must be above the last price (820).');
  });
});
