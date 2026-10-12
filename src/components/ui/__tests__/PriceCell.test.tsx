import { render, screen } from '@testing-library/react';
import { PriceCell, directionOf } from '../PriceCell';

test('directionOf reads only the sign of a move', () => {
  expect(directionOf(12.5)).toBe('up');
  expect(directionOf(1)).toBe('up');
  expect(directionOf(-0.05)).toBe('down');
  expect(directionOf(0)).toBe('flat');
  expect(directionOf(undefined)).toBe('flat');
  expect(directionOf(NaN)).toBe('flat');
});

test('a rise is green, with an up arrow and the word "up" for screen readers', () => {
  render(<PriceCell value={3101.5} change={12.4} data-testid="cell" />);

  const cell = screen.getByTestId('cell');
  expect(cell).toHaveClass('text-up', 'tabular-nums');
  expect(cell).toHaveAttribute('data-direction', 'up');
  expect(cell).toHaveTextContent('▲3101.50 up');
  // The arrow is drawn for sighted users and hidden from screen readers,
  // which hear the word instead.
  expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByText('up')).toHaveClass('sr-only');
});

test('a fall is red, with a down arrow and the word "down"', () => {
  render(<PriceCell value={1499.95} change={-0.05} data-testid="cell" />);

  const cell = screen.getByTestId('cell');
  expect(cell).toHaveClass('text-down');
  expect(cell).not.toHaveClass('text-up');
  expect(cell).toHaveTextContent('▼1499.95 down');
});

test('no move means no colour, no arrow and no extra word', () => {
  render(<PriceCell value={250} data-testid="cell" />);

  const cell = screen.getByTestId('cell');
  expect(cell).toHaveClass('text-fg');
  expect(cell).toHaveAttribute('data-direction', 'flat');
  expect(cell).toHaveTextContent(/^250\.00$/);
});

test('uses the format it is given', () => {
  const rupees = (value: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  render(<PriceCell value={123456.7} change={1} format={rupees} data-testid="cell" />);

  expect(screen.getByTestId('cell')).toHaveTextContent('1,23,456.70');
});
