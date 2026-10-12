import type { BookSnapshot } from '@/lib/types';
import { buildLadder } from '../ladder';

const book: BookSnapshot = {
  symbol: 'TCS',
  // Out of order on purpose: buildLadder sorts each side itself.
  bids: [
    { price: 3098, qty: 1 },
    { price: 3099.5, qty: 2 },
    { price: 3099, qty: 5 },
  ],
  asks: [
    { price: 3101, qty: 4 },
    { price: 3100.5, qty: 1 },
  ],
  ts: 0,
};

test('sorts each side best price first and adds running totals', () => {
  const ladder = buildLadder(book, 10);

  expect(ladder.bids).toEqual([
    { price: 3099.5, qty: 2, total: 2 },
    { price: 3099, qty: 5, total: 7 },
    { price: 3098, qty: 1, total: 8 },
  ]);
  expect(ladder.asks).toEqual([
    { price: 3100.5, qty: 1, total: 1 },
    { price: 3101, qty: 4, total: 5 },
  ]);
  expect(ladder.maxTotal).toBe(8);
});

test('keeps only the best `depth` levels per side', () => {
  const ladder = buildLadder(book, 2);

  expect(ladder.bids.map((row) => row.price)).toEqual([3099.5, 3099]);
  expect(ladder.maxTotal).toBe(7);
});

test('measures the spread between the best ask and the best bid', () => {
  const { spread, spreadPct } = buildLadder(book, 10);

  expect(spread).toBe(1);
  expect(spreadPct).toBeCloseTo((1 / 3100) * 100); // mid price is 3100
});

test('has no spread while one side of the book is empty', () => {
  const ladder = buildLadder({ ...book, asks: [] }, 10);

  expect(ladder.spread).toBeNull();
  expect(ladder.spreadPct).toBeNull();
});
