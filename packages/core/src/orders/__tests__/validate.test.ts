import type { OrderRequest } from '../../types';
import { validateOrder } from '../validate';

const limit: OrderRequest = { type: 'LIMIT', side: 'BUY', symbol: 'TCS', qty: 10, price: 3100 };
const market: OrderRequest = { type: 'MARKET', side: 'SELL', symbol: 'TCS', qty: 10 };
const buyStop: OrderRequest = { type: 'SL', side: 'BUY', symbol: 'TCS', qty: 10, trigger: 3150, price: 3155 };
const sellStop: OrderRequest = { type: 'SL', side: 'SELL', symbol: 'TCS', qty: 10, trigger: 3050, price: 3045 };

describe('validateOrder', () => {
  it('accepts valid orders of every type', () => {
    expect(validateOrder(limit)).toBeNull();
    expect(validateOrder(market, 3100)).toBeNull();
    expect(validateOrder(buyStop, 3100)).toBeNull();
    expect(validateOrder(sellStop, 3100)).toBeNull();
  });

  it('requires a symbol', () => {
    expect(validateOrder({ ...limit, symbol: '' })).toMatch(/symbol/i);
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects quantity %p: it must be a whole number above 0', (qty) => {
    expect(validateOrder({ ...limit, qty })).toMatch(/quantity/i);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects limit price %p', (price) => {
    expect(validateOrder({ ...limit, price })).toMatch(/limit price/i);
  });

  it('needs a last price for a market order', () => {
    expect(validateOrder(market)).toMatch(/no price for TCS/i);
  });

  describe('stop-loss', () => {
    it('rejects a trigger or limit price that is not above 0', () => {
      expect(validateOrder({ ...sellStop, trigger: 0 })).toMatch(/trigger price/i);
      expect(validateOrder({ ...sellStop, price: -1 })).toMatch(/limit price/i);
    });

    it('BUY: the limit price must be at or above the trigger', () => {
      expect(validateOrder({ ...buyStop, price: 3149 })).toMatch(/at or above the trigger/);
      expect(validateOrder({ ...buyStop, price: 3150 })).toBeNull();
    });

    it('BUY: the trigger must be above the last price', () => {
      expect(validateOrder(buyStop, 3150)).toMatch(/above the last price \(3150\)/);
      expect(validateOrder(buyStop, 3149.95)).toBeNull();
    });

    it('SELL: the limit price must be at or below the trigger', () => {
      expect(validateOrder({ ...sellStop, price: 3051 })).toMatch(/at or below the trigger/);
      expect(validateOrder({ ...sellStop, price: 3050 })).toBeNull();
    });

    it('SELL: the trigger must be below the last price', () => {
      expect(validateOrder(sellStop, 3050)).toMatch(/below the last price \(3050\)/);
      expect(validateOrder(sellStop, 3050.05)).toBeNull();
    });

    it('checks only the trigger-versus-limit rule while there is no last price', () => {
      expect(validateOrder(buyStop)).toBeNull();
      expect(validateOrder(sellStop)).toBeNull();
    });
  });
});
