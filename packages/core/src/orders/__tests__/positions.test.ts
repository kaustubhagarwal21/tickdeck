import type { Position, Side } from '../../types';
import { applyFill } from '../positions';

const fill = (side: Side, qty: number, price: number) => ({ symbol: 'TCS', side, qty, price });
const position = (qty: number, avgPrice: number): Position => ({ symbol: 'TCS', qty, avgPrice });

describe('applyFill', () => {
  it('opens a long with a buy and a short with a sell', () => {
    expect(applyFill(undefined, fill('BUY', 10, 100))).toEqual(position(10, 100));
    expect(applyFill(undefined, fill('SELL', 4, 100))).toEqual(position(-4, 100));
  });

  it('averages the price when adding to a long', () => {
    // 10 @ 100 plus 30 @ 104: (1000 + 3120) / 40 = 103
    expect(applyFill(position(10, 100), fill('BUY', 30, 104))).toEqual(position(40, 103));
  });

  it('averages the price when adding to a short', () => {
    // -10 @ 100 plus -10 @ 90: average 95
    expect(applyFill(position(-10, 100), fill('SELL', 10, 90))).toEqual(position(-20, 95));
  });

  it('keeps the average price when reducing', () => {
    expect(applyFill(position(10, 100), fill('SELL', 4, 120))).toEqual(position(6, 100));
    expect(applyFill(position(-10, 100), fill('BUY', 4, 80))).toEqual(position(-6, 100));
  });

  it('returns null when the position closes exactly', () => {
    expect(applyFill(position(10, 100), fill('SELL', 10, 120))).toBeNull();
    expect(applyFill(position(-3, 100), fill('BUY', 3, 90))).toBeNull();
  });

  it('reverses through zero, opening the remainder at the fill price', () => {
    // Long 10, sell 15: the long closes and a 5-share short opens at 110.
    expect(applyFill(position(10, 100), fill('SELL', 15, 110))).toEqual(position(-5, 110));
    // Short 5, buy 8: the short closes and a 3-share long opens at 90.
    expect(applyFill(position(-5, 110), fill('BUY', 8, 90))).toEqual(position(3, 90));
  });
});
