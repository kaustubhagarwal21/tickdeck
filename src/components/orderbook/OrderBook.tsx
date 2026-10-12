'use client';

import { memo, type ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { formatPrice, formatQty, priceDecimals } from '@/components/common/format';
import { Panel } from '@/components/common/Panel';
import { Skeleton } from '@/components/common/Skeleton';
import type { BookSnapshot } from '@/lib/types';
import { useBook, useFeedStatus, useSelected } from '@/store/selectors';
import { buildLadder } from './ladder';

/** Price levels shown on each side of the book. */
const DEPTH = 10;

/**
 * Column layout shared by the header, level and spread rows. shrink-0 keeps
 * every row at full height in a short panel; the ladder clips rows instead.
 */
const COLUMNS = 'grid shrink-0 grid-cols-3 items-center gap-2 px-3';

/**
 * Market depth for the selected symbol: up to 10 asks above the spread and up
 * to 10 bids below it, like the ladder on an exchange terminal.
 */
export function OrderBook() {
  const symbol = useSelected();
  const book = useBook(symbol);
  const status = useFeedStatus();

  let body: ReactNode;
  if (!symbol) {
    body = <EmptyState title="No symbol selected" hint="Choose one in the watchlist to see its order book." />;
  } else if (book) {
    body = <BookTable symbol={symbol} book={book} />;
  } else if (status === 'error' || status === 'closed') {
    body = <EmptyState title="Order book unavailable" hint="The market feed is disconnected." />;
  } else {
    body = <BookSkeleton />;
  }

  return (
    <Panel
      title="Order book"
      aside={symbol ? <span className="text-[11px] text-muted">{symbol}</span> : null}
      bodyClassName="overflow-hidden"
    >
      {body}
    </Panel>
  );
}

/**
 * The ladder itself. It uses ARIA table roles on <div>s rather than a <table>:
 * each row needs `position: relative` to hold its depth bar, and that has a
 * long history of browser quirks on <tr>. Screen readers still get a table.
 *
 * Asks and bids each get half of the height. When the panel is too short for
 * every level, the levels farthest from the spread are cut off first: asks
 * are pinned to the bottom of their half and bids to the top, so the best
 * prices on both sides always stay in view, as on an exchange screen.
 */
function BookTable({ symbol, book }: { symbol: string; book: BookSnapshot }) {
  const { asks, bids, maxTotal, spread, spreadPct } = buildLadder(book, DEPTH);
  const depthOf = (total: number) => (maxTotal > 0 ? total / maxTotal : 0);

  // Show the spread with as many decimals as the prices around it.
  const refPrice = bids[0]?.price ?? asks[0]?.price ?? 0;
  const spreadText = spread === null ? '–' : spread.toFixed(priceDecimals(symbol, refPrice));

  return (
    <div
      role="table"
      aria-label={`Order book for ${symbol}`}
      className="flex h-full flex-col py-1 font-mono text-xs tabular-nums"
    >
      <div role="rowgroup" className="shrink-0">
        <div role="row" className={`${COLUMNS} h-5 font-sans text-[10px] tracking-wider text-muted uppercase`}>
          <span role="columnheader">Price</span>
          <span role="columnheader" className="text-right">
            Qty
          </span>
          <span role="columnheader" className="text-right">
            Total
          </span>
        </div>
      </div>

      {/* Highest ask on top, so the best ask sits right above the spread. */}
      <div role="rowgroup" aria-label="Asks" className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        {[...asks].reverse().map((level) => (
          <LevelRow
            key={level.price}
            symbol={symbol}
            side="ask"
            price={level.price}
            qty={level.qty}
            total={level.total}
            depth={depthOf(level.total)}
          />
        ))}
      </div>

      <div role="row" className={`${COLUMNS} my-1 h-7 border-y border-line bg-ink/40`}>
        {/* Spaces between the spans keep the screen-reader text readable. */}
        <span role="cell" className="col-span-3 flex items-baseline justify-center gap-2">
          <span className="font-sans text-muted">Spread</span> <span>{spreadText}</span>{' '}
          {spreadPct !== null && <span className="text-muted">({formatSpreadPct(spreadPct)})</span>}
        </span>
      </div>

      {/* Best bid on top, right below the spread. */}
      <div role="rowgroup" aria-label="Bids" className="min-h-0 flex-1 overflow-hidden">
        {bids.map((level) => (
          <LevelRow
            key={level.price}
            symbol={symbol}
            side="bid"
            price={level.price}
            qty={level.qty}
            total={level.total}
            depth={depthOf(level.total)}
          />
        ))}
      </div>
    </div>
  );
}

interface LevelRowProps {
  symbol: string;
  side: 'bid' | 'ask';
  price: number;
  qty: number;
  total: number;
  /** total / maxTotal, from 0 to 1: how far the depth bar reaches. */
  depth: number;
}

/**
 * One price level. Every prop is a plain value, so memo() skips any level whose
 * price, quantity and depth did not change since the last snapshot.
 */
const LevelRow = memo(function LevelRow({ symbol, side, price, qty, total, depth }: LevelRowProps) {
  return (
    <div role="row" className={`relative h-5 ${COLUMNS}`}>
      {/* The depth bar is sized with transform: scaleX() instead of width:
          changing a transform never makes the browser recompute layout. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-px right-0 w-full origin-right ${side === 'bid' ? 'bg-up/15' : 'bg-down/15'}`}
        style={{ transform: `scaleX(${depth})` }}
      />
      <span role="cell" className={`relative ${side === 'bid' ? 'text-up' : 'text-down'}`}>
        {formatPrice(symbol, price)}
      </span>
      <span role="cell" className="relative text-right">
        {formatQty(symbol, qty, price)}
      </span>
      <span role="cell" className="relative text-right text-muted">
        {formatQty(symbol, total, price)}
      </span>
    </div>
  );
});

/** Spreads are tiny, often a few thousandths of a percent. */
function formatSpreadPct(pct: number): string {
  return pct < 0.001 ? '<0.001%' : `${pct.toFixed(3)}%`;
}

/** Placeholder ladder shown until the first snapshot for the symbol arrives. */
function BookSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3">
      <p className="sr-only">Loading order book…</p>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-10 justify-self-end" />
          <Skeleton className="h-2.5 w-12 justify-self-end" />
        </div>
      ))}
    </div>
  );
}
