import {
  describeOrder,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQty,
  priceInputValue,
  signColor,
} from '../format';

describe('formatPrice', () => {
  test('uses Indian digit grouping for rupee prices', () => {
    expect(formatPrice('RELIANCE', 123456.7)).toBe('1,23,456.70');
    expect(formatPrice('SBIN', 820)).toBe('820.00');
  });

  test('uses international grouping for USDT prices', () => {
    expect(formatPrice('BTCUSDT', 123456.7)).toBe('123,456.70');
  });

  test('gives cheap coins enough decimals to show a price move', () => {
    expect(formatPrice('XRPUSDT', 2.51234)).toBe('2.5123');
    expect(formatPrice('DOGEUSDT', 0.213456)).toBe('0.21346');
  });
});

test('priceInputValue has no grouping commas, so it can go straight into an input', () => {
  expect(priceInputValue('TCS', 3100)).toBe('3100.00');
  expect(priceInputValue('DOGEUSDT', 0.2)).toBe('0.20000');
});

test('formatQty shows whole shares for stocks and fractions for coins', () => {
  expect(formatQty('TCS', 1500)).toBe('1,500');
  expect(formatQty('BTCUSDT', 0.00125)).toBe('0.00125');
});

test('formatQty with a price uses fixed decimals, so a column lines up', () => {
  // BTC is sized in 0.00001s, so 0.014 BTC gets the same five decimals as 0.00014.
  expect(formatQty('BTCUSDT', 0.014, 84000)).toBe('0.01400');
  expect(formatQty('BTCUSDT', 0.00014, 84000)).toBe('0.00014');
  // Sums of floating-point quantities are rounded to the step, hiding float noise.
  expect(formatQty('BTCUSDT', 0.00014 + 0.00007, 84000)).toBe('0.00021');
  // Cheap coins and stocks trade in whole units.
  expect(formatQty('DOGEUSDT', 1234, 0.2)).toBe('1,234');
  expect(formatQty('TCS', 15, 3100)).toBe('15');
});

test('formatMoney adds the currency, and a plus sign for signed gains', () => {
  expect(formatMoney('TCS', 14500.5)).toBe('₹14,500.50');
  expect(formatMoney('TCS', 1000, true)).toBe('+₹1,000.00');
  expect(formatMoney('TCS', -100, true)).toBe('-₹100.00');
  expect(formatMoney('BTCUSDT', -12.5, true)).toBe('-12.50 USDT');
});

test('formatPercent always shows the sign, except for zero', () => {
  expect(formatPercent(1.234)).toBe('+1.23%');
  expect(formatPercent(-0.4)).toBe('-0.40%');
  expect(formatPercent(0)).toBe('0.00%');
});

test('signColor maps gains, losses and nothing to colours', () => {
  expect(signColor(5)).toBe('text-up');
  expect(signColor(-5)).toBe('text-down');
  expect(signColor(0)).toBe('text-muted');
  expect(signColor(undefined)).toBe('text-muted');
});

test('describeOrder summarises each order type in one line', () => {
  expect(describeOrder({ type: 'MARKET', side: 'BUY', symbol: 'TCS', qty: 10 })).toBe('Buy 10 TCS at market');
  expect(describeOrder({ type: 'LIMIT', side: 'SELL', symbol: 'TCS', qty: 5, price: 3100 })).toBe(
    'Sell 5 TCS at limit 3,100.00',
  );
  expect(describeOrder({ type: 'SL', side: 'SELL', symbol: 'TCS', qty: 5, trigger: 3095, price: 3090 })).toBe(
    'Sell 5 TCS at limit 3,090.00, trigger 3,095.00',
  );
});
