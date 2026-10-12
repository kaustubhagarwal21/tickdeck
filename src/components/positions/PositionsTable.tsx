'use client';

import { memo } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { formatMoney, formatPercent, formatPrice, formatQty, signColor } from '@/components/common/format';
import type { Position } from '@/lib/types';
import { useQuote } from '@/store/selectors';

const CELL = 'px-3 py-1.5 text-right font-mono tabular-nums';

/** Open positions with live profit and loss. */
export function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <EmptyState title="No positions yet" hint="When an order fills, the position appears here with live P&L." />;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-panel text-[10px] tracking-wider text-muted uppercase">
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium">
            Symbol
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Qty
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Avg price
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Last
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            P&amp;L
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            P&amp;L %
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <PositionRow key={position.symbol} position={position} />
        ))}
      </tbody>
    </table>
  );
}

/**
 * One position. Like a watchlist row, it subscribes only to its own symbol's
 * quote, so its P&L updates live without re-rendering the other rows.
 */
const PositionRow = memo(function PositionRow({ position }: { position: Position }) {
  const { symbol, qty, avgPrice } = position;
  const quote = useQuote(symbol);

  // (last - average) x quantity. It also works for a short position: qty is
  // negative there, so a falling price gives a positive P&L.
  const pnl = quote ? (quote.last - avgPrice) * qty : undefined;
  const pnlPct = pnl === undefined ? undefined : (pnl / Math.abs(avgPrice * qty)) * 100;
  const color = signColor(pnl);

  return (
    <tr className="border-t border-line">
      <th scope="row" className="px-3 py-1.5 text-left font-medium">
        {symbol}{' '}
        <span className={`ml-1 text-[10px] font-normal ${qty > 0 ? 'text-up' : 'text-down'}`}>
          {qty > 0 ? 'Long' : 'Short'}
        </span>
      </th>
      <td className={CELL}>{formatQty(symbol, qty, avgPrice)}</td>
      <td className={CELL}>{formatPrice(symbol, avgPrice)}</td>
      <td className={CELL}>{quote ? formatPrice(symbol, quote.last) : '–'}</td>
      <td className={`${CELL} ${color}`}>{pnl === undefined ? '–' : formatMoney(symbol, pnl, true)}</td>
      <td className={`${CELL} ${color}`}>{pnlPct === undefined ? '–' : formatPercent(pnlPct)}</td>
    </tr>
  );
});
