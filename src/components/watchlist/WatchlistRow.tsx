'use client';

import { memo, useState } from 'react';
import { formatPercent, formatPrice, isCryptoSymbol, signColor } from '@/components/common/format';
import { Skeleton } from '@/components/common/Skeleton';
import type { Quote } from '@tickdeck/core';
import { useQuote } from '@/store/selectors';

interface WatchlistRowProps {
  /** DOM id, so the list can point aria-activedescendant at this row. */
  id: string;
  symbol: string;
  isSelected: boolean;
  /** The row the arrow keys are on. It shows the focus ring while the list has focus. */
  isActive: boolean;
  onSelect: (symbol: string) => void;
}

/**
 * One instrument in the watchlist.
 *
 * Two things keep it cheap when hundreds of trades arrive per second:
 *  - it subscribes only to its own quote, so a TCS trade re-renders the TCS
 *    row and no other;
 *  - memo() skips it when the list re-renders with the same props.
 */
export const WatchlistRow = memo(function WatchlistRow({
  id,
  symbol,
  isSelected,
  isActive,
  onSelect,
}: WatchlistRowProps) {
  const quote = useQuote(symbol);

  return (
    // Keyboard handling lives on the parent listbox, which keeps the focus.
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      data-active={isActive}
      onClick={() => onSelect(symbol)}
      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 hover:bg-raised/50 aria-selected:bg-raised aria-selected:shadow-[inset_2px_0_0_var(--color-accent)]"
    >
      <span className="truncate text-sm font-medium">{symbol}</span>{' '}
      {quote ? (
        <span className="relative isolate justify-self-end font-mono text-sm tabular-nums">
          {/* key={price}: a new flash element mounts only when the price changes. */}
          <PriceFlash key={quote.last} dir={quote.dir} />
          {formatPrice(symbol, quote.last)}
        </span>
      ) : (
        <Skeleton className="h-3.5 w-16 justify-self-end" />
      )}{' '}
      <span className="text-[11px] text-muted">{isCryptoSymbol(symbol) ? 'Binance' : 'NSE'}</span>{' '}
      {quote ? (
        <span className={`justify-self-end font-mono text-xs tabular-nums ${signColor(quote.change)}`}>
          {formatPercent(quote.changePct)}
        </span>
      ) : (
        <Skeleton className="h-3 w-12 justify-self-end" />
      )}
    </li>
  );
});

/**
 * A green or red background flash behind a price that just moved.
 *
 * The row gives this component key={price}, so React mounts a fresh element,
 * and the browser restarts the CSS animation, only when the price changes.
 * `dir` is read once, when the element mounts: a later trade at the same price
 * (dir 0) keeps the same key and must not cut a running flash short.
 *
 * The animation (`.flash` in globals.css) changes only opacity. The browser can
 * run that on its compositor thread, with no layout, no repaint of the row and
 * no JavaScript while it plays.
 */
function PriceFlash({ dir }: { dir: Quote['dir'] }) {
  const [direction] = useState(dir);
  if (direction === 0) return null;
  return <span aria-hidden="true" className={direction > 0 ? 'flash flash-up' : 'flash flash-down'} />;
}
