'use client';

import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Panel } from '@/components/common/Panel';
import { SimulatedBadge } from '@/components/common/SimulatedBadge';
import { Skeleton } from '@/components/common/Skeleton';
import { useMarketStore } from '@/store/marketStore';
import { useFeedKind, useSelected, useSymbols } from '@/store/selectors';
import { WatchlistRow } from './WatchlistRow';

/**
 * The instruments of the current feed. Choosing one sets the symbol that the
 * chart, order book and order ticket show.
 *
 * Keyboard use follows the WAI-ARIA listbox pattern: Tab focuses the list,
 * ArrowUp / ArrowDown / Home / End move a highlight, and Enter or Space selects
 * the highlighted row. Moving does not select, so you can scan the list
 * without reloading the chart for every row you pass.
 *
 * DOM focus stays on the <ul>. aria-activedescendant tells screen readers which
 * row is highlighted, so the rows need no tab stops or refs of their own.
 */
export function Watchlist() {
  const symbols = useSymbols();
  const feedKind = useFeedKind();
  const selected = useSelected();
  const select = useMarketStore((s) => s.select);

  // The row the arrow keys have moved to; null means "the selected row".
  const [active, setActive] = useState<string | null>(null);
  const activeSymbol = active ?? selected;

  const idPrefix = useId();
  const optionId = (symbol: string) => `${idPrefix}${symbol}`;

  // Every memoized row receives this function. useCallback keeps it the same
  // object across renders; a new one each time would re-render every row.
  const choose = useCallback(
    (symbol: string) => {
      select(symbol);
      setActive(null);
    },
    [select],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = symbols.length - 1;
    const current = Math.max(0, symbols.indexOf(activeSymbol));
    let next: number;

    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(current + 1, last);
        break;
      case 'ArrowUp':
        next = Math.max(current - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault(); // Space would otherwise scroll the page.
        choose(symbols[current]);
        return;
      default:
        return; // Leave Tab and every other key alone.
    }

    event.preventDefault(); // Stop the arrow keys from scrolling the page.
    setActive(symbols[next]);
  }

  // Which market the prices come from. Nothing until the feed has started, so
  // the page never shows a feed label that is about to change.
  let source: ReactNode = null;
  if (symbols.length > 0) {
    source =
      feedKind === 'simulated' ? (
        <SimulatedBadge />
      ) : (
        <span className="text-[11px] text-muted">Binance · USDT</span>
      );
  }

  return (
    <Panel title="Watchlist" aside={source} bodyClassName="overflow-y-auto">
      {symbols.length === 0 ? (
        <WatchlistSkeleton />
      ) : (
        <ul
          role="listbox"
          aria-label="Watchlist"
          tabIndex={0}
          aria-activedescendant={symbols.includes(activeSymbol) ? optionId(activeSymbol) : undefined}
          onKeyDown={handleKeyDown}
          onBlur={() => setActive(null)}
          className="py-1"
        >
          {symbols.map((symbol) => (
            <WatchlistRow
              key={symbol}
              id={optionId(symbol)}
              symbol={symbol}
              isSelected={symbol === selected}
              isActive={symbol === activeSymbol}
              onSelect={choose}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Shown until the feed has told the store which symbols it streams. */
function WatchlistSkeleton() {
  return (
    <div className="py-1">
      <p className="sr-only">Loading prices…</p>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16 justify-self-end" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-12 justify-self-end" />
        </div>
      ))}
    </div>
  );
}
