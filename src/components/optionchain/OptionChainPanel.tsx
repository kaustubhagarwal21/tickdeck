'use client';

import { useMemo, useState } from 'react';
import {
  buildChain,
  nextExpiry,
  strikeStepFor,
  type ChainRow,
  type ExpiryKind,
  type OptionQuote,
} from '@tickdeck/core';
import { EmptyState } from '@/components/common/EmptyState';
import { formatPrice, isCryptoSymbol } from '@/components/common/format';
import { Panel } from '@/components/common/Panel';
import { Segmented, type SegmentOption } from '@/components/common/Segmented';
import { SimulatedBadge } from '@/components/common/SimulatedBadge';
import { Skeleton } from '@/components/common/Skeleton';
import { useFeedStatus, useQuote, useSelected } from '@/store/selectors';

// Model inputs. They are assumptions, not market data, which is why the table
// is labelled as a simulated chain.
const STRIKES_EACH_SIDE = 10;
const ASSUMED_RATE = 0.06; // risk-free rate, 6% a year
const ASSUMED_SMILE = 3; // how fast IV rises away from spot; see smileIv() in @tickdeck/core

/** ATM implied volatility: crypto swings far more than large Indian stocks. */
function assumedIvAtm(symbol: string): number {
  return isCryptoSymbol(symbol) ? 0.6 : 0.2;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const EXPIRY_OPTIONS: readonly SegmentOption<ExpiryKind>[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** One column of numbers, shown once for calls and once for puts. */
interface Column {
  label: string;
  format: (option: OptionQuote, symbol: string) => string;
}

const BASE_COLUMNS: Column[] = [
  { label: 'LTP', format: (o, symbol) => formatPrice(symbol, o.price) },
  { label: 'Delta', format: (o) => fixed(o.delta, 2) },
  { label: 'IV', format: (o) => `${(o.iv * 100).toFixed(1)}%` },
];

/** Shown only when "All Greeks" is on, to keep the default table narrow. */
const GREEK_COLUMNS: Column[] = [
  { label: 'Gamma', format: (o) => fixed(o.gamma, 4) },
  { label: 'Theta', format: (o) => fixed(o.theta, 2) },
  { label: 'Vega', format: (o) => fixed(o.vega, 2) },
];

/** A number with fixed decimals, without the "-0.00" a tiny negative value would give. */
function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return Number(text) === 0 ? (0).toFixed(decimals) : text;
}

// Built once: creating an Intl formatter is far slower than using one.
const STOCK_STRIKE = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const CRYPTO_STRIKE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 });
const EXPIRY_DATE = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Strikes without trailing zeros: "3,100", "1,002.5", "0.213". */
function formatStrike(symbol: string, strike: number): string {
  return (isCryptoSymbol(symbol) ? CRYPTO_STRIKE : STOCK_STRIKE).format(strike);
}

/**
 * The option chain in its own panel card, for a standalone grid slot. To show
 * it as a tab inside another panel, render <OptionChain /> instead.
 */
export function OptionChainPanel() {
  const symbol = useSelected();
  return (
    <Panel
      title="Option chain"
      aside={
        <span className="flex items-center gap-2 text-[11px] text-muted">
          {symbol}
          <SimulatedBadge />
        </span>
      }
      bodyClassName="flex flex-col"
    >
      <OptionChain />
    </Panel>
  );
}

/**
 * A simulated option chain for the selected symbol: Black-Scholes values for
 * strikes around its last price, laid out CALLS | STRIKE | PUTS.
 */
export function OptionChain() {
  const symbol = useSelected();
  const quote = useQuote(symbol);
  const status = useFeedStatus();
  const [expiryKind, setExpiryKind] = useState<ExpiryKind>('weekly');
  const [showGreeks, setShowGreeks] = useState(false);

  if (!symbol) {
    return <EmptyState title="No symbol selected" hint="Choose one in the watchlist to see its option chain." />;
  }
  if (!quote) {
    if (status === 'error' || status === 'closed') {
      return <EmptyState title="Option chain unavailable" hint="The market feed is disconnected, so there is no price." />;
    }
    return <ChainSkeleton />;
  }

  // Time to expiry is measured from the latest trade's time, not by reading
  // the clock during render, so the chain is a pure function of the quote.
  const nowMs = quote.ts;
  const expiryMs = nextExpiry(expiryKind, nowMs);
  const daysLeft = (expiryMs - nowMs) / DAY_MS;
  // The strike step comes from the session's first price (quote.open), not
  // the last one, so it stays fixed: a price wobbling around a boundary such
  // as 2,500 would otherwise flip the ladder between steps of 10 and 25.
  const strikeStep = strikeStepFor(quote.open);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2 text-xs">
        <div className="w-40">
          <Segmented legend="Expiry" options={EXPIRY_OPTIONS} value={expiryKind} onChange={setExpiryKind} />
        </div>
        <p className="text-muted">
          Expires <span className="text-fg">{EXPIRY_DATE.format(expiryMs)}</span>{' '}
          <span className="font-mono tabular-nums">({daysLeft.toFixed(1)} days)</span>
        </p>
        <p className="text-muted">
          Spot <span className="font-mono text-fg tabular-nums">{formatPrice(symbol, quote.last)}</span>
        </p>
        <button
          type="button"
          aria-pressed={showGreeks}
          onClick={() => setShowGreeks((on) => !on)}
          className="ml-auto h-7 rounded border border-line px-2 text-muted transition-colors hover:text-fg aria-pressed:bg-raised aria-pressed:text-fg"
        >
          All Greeks
        </button>
      </div>

      <ChainTable
        symbol={symbol}
        spot={quote.last}
        strikeStep={strikeStep}
        nowMs={nowMs}
        expiryMs={expiryMs}
        showGreeks={showGreeks}
      />
    </div>
  );
}

interface ChainTableProps {
  symbol: string;
  spot: number;
  strikeStep: number;
  nowMs: number;
  expiryMs: number;
  showGreeks: boolean;
}

function ChainTable({ symbol, spot, strikeStep, nowMs, expiryMs, showGreeks }: ChainTableProps) {
  // Recomputed only when an input changes. The market store commits at most
  // once per animation frame, so this runs at most once a frame: 21 strikes,
  // 42 Black-Scholes prices, well under a millisecond.
  const rows = useMemo(
    () =>
      buildChain({
        spot,
        strikeStep,
        strikesEachSide: STRIKES_EACH_SIDE,
        expiryMs,
        nowMs,
        rate: ASSUMED_RATE,
        ivAtm: assumedIvAtm(symbol),
        smile: ASSUMED_SMILE,
      }),
    [symbol, spot, strikeStep, nowMs, expiryMs],
  );

  if (rows.length === 0) {
    return <EmptyState title="No strikes to show" hint="The last price cannot anchor an option chain." />;
  }

  const putColumns = showGreeks ? [...BASE_COLUMNS, ...GREEK_COLUMNS] : BASE_COLUMNS;
  // Calls mirror puts, so each side's LTP sits right next to the strike.
  const callColumns = [...putColumns].reverse();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full font-mono text-xs tabular-nums">
        <caption className="px-3 py-1.5 text-left font-sans text-[11px] text-muted">
          Simulated chain: Black-Scholes with an assumed IV smile
          <span className="sr-only">
            . {symbol} options expiring {EXPIRY_DATE.format(expiryMs)}.
          </span>
        </caption>
        {/* Column groups give the "Calls" and "Puts" headers (scope="colgroup") their columns. */}
        <colgroup span={callColumns.length} />
        <colgroup span={1} />
        <colgroup span={putColumns.length} />
        <thead className="sticky top-0 z-10 bg-panel font-sans text-[10px] tracking-wider text-muted uppercase">
          <tr>
            <th scope="colgroup" colSpan={callColumns.length} className="px-2 pt-1.5 text-center font-semibold text-up">
              Calls
            </th>
            <th scope="col" rowSpan={2} className="border-x border-line px-2 text-center font-semibold">
              Strike
            </th>
            <th scope="colgroup" colSpan={putColumns.length} className="px-2 pt-1.5 text-center font-semibold text-down">
              Puts
            </th>
          </tr>
          <tr className="border-b border-line">
            {callColumns.map((column) => (
              <th key={column.label} scope="col" className="px-2 py-1 text-right font-medium">
                {column.label}
              </th>
            ))}
            {putColumns.map((column) => (
              <th key={column.label} scope="col" className="px-2 py-1 text-right font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StrikeRow key={row.strike} symbol={symbol} row={row} callColumns={callColumns} putColumns={putColumns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CELL = 'px-2 py-1 text-right';
/** In-the-money cells get a light amber wash, like the shading on exchange option chains. */
const ITM_SHADE = 'bg-accent/10';

interface StrikeRowProps {
  symbol: string;
  row: ChainRow;
  callColumns: Column[];
  putColumns: Column[];
}

/**
 * One strike. Not wrapped in memo(): when the spot price moves, every option
 * on the chain is repriced, so every row has new values anyway.
 */
function StrikeRow({ symbol, row, callColumns, putColumns }: StrikeRowProps) {
  const { call, put, strike, isAtm } = row;
  return (
    <tr className={isAtm ? 'border-y border-accent/60' : 'border-t border-line/60'}>
      {callColumns.map((column) => (
        <td key={column.label} data-itm={call.itm || undefined} className={`${CELL} ${call.itm ? ITM_SHADE : ''}`}>
          {column.format(call, symbol)}
        </td>
      ))}
      <th
        scope="row"
        className={`border-x border-line px-2 py-1 text-center font-semibold ${isAtm ? 'bg-accent/15 text-accent' : ''}`}
      >
        {formatStrike(symbol, strike)}
        {isAtm && <span className="sr-only"> (at the money)</span>}
      </th>
      {putColumns.map((column) => (
        <td key={column.label} data-itm={put.itm || undefined} className={`${CELL} ${put.itm ? ITM_SHADE : ''}`}>
          {column.format(put, symbol)}
        </td>
      ))}
    </tr>
  );
}

/** Placeholder rows shown until the selected symbol's first price arrives. */
function ChainSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3">
      <p className="sr-only">Loading option chain…</p>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="grid grid-cols-3 gap-4">
          <Skeleton className="h-2.5 w-16 justify-self-end" />
          <Skeleton className="h-2.5 w-12 justify-self-center" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}
