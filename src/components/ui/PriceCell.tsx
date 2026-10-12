import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export type PriceDirection = 'up' | 'down' | 'flat';

/** The direction of a signed move: above zero is up, below zero is down, zero or unknown is flat. */
export function directionOf(change: number | undefined): PriceDirection {
  if (change === undefined || Number.isNaN(change) || change === 0) return 'flat';
  return change > 0 ? 'up' : 'down';
}

const LOOK: Record<PriceDirection, { glyph: string; word: string; color: string }> = {
  up: { glyph: '▲', word: 'up', color: 'text-up' },
  down: { glyph: '▼', word: 'down', color: 'text-down' },
  flat: { glyph: '', word: '', color: 'text-fg' },
};

export interface PriceCellProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The number to show. */
  value: number;
  /**
   * The move that sets the colour and the arrow. Only its sign matters, so a
   * day change (quote.change) and a last-tick direction (quote.dir) both work.
   */
  change?: number;
  /** Turns the number into text. Defaults to two decimals; pass formatPrice for a symbol's own format. */
  format?: (value: number) => string;
}

const twoDecimals = (value: number) => value.toFixed(2);

/**
 * A price with its direction: green with ▲ when it went up, red with ▼ when it
 * went down.
 *
 * - Colour is never the only signal: the arrow shows the direction to anyone
 *   who cannot tell red from green, and a visually hidden word ("up" / "down")
 *   tells screen readers, since the arrow itself is hidden from them.
 * - tabular-nums in the monospaced font gives every digit the same width, so a
 *   column of prices lines up and does not jiggle as prices change. The arrow
 *   slot keeps its width when there is no arrow, for the same reason.
 *
 * It is a <span>, so it fits in a table cell, a list row or a title bar.
 */
export function PriceCell({ value, change, format = twoDecimals, className, ...rest }: PriceCellProps) {
  const direction = directionOf(change);
  const look = LOOK[direction];

  return (
    <span
      data-direction={direction}
      className={cx('inline-flex items-baseline gap-1 font-mono tabular-nums', look.color, className)}
      {...rest}
    >
      <span aria-hidden="true" className="inline-block w-[1.5ch] text-center text-[0.7em]">
        {look.glyph}
      </span>
      {format(value)}
      {look.word && <span className="sr-only"> {look.word}</span>}
    </span>
  );
}
