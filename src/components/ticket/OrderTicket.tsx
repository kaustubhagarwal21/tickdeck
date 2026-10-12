'use client';

import { useId, useState, type SubmitEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { describeOrder, formatMoney, formatPrice, priceInputValue } from '@/components/common/format';
import { Panel } from '@/components/common/Panel';
import { Segmented, type SegmentOption } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { validateOrder } from '@tickdeck/core';
import type { Side } from '@tickdeck/core';
import { useMarketStore } from '@/store/marketStore';
import { useOrderStore } from '@/store/orderStore';
import { useSelected } from '@/store/selectors';
import { changeOrderType, parseAmount, toOrderRequest, type OrderType, type TicketForm } from './ticketForm';

const SIDES: SegmentOption<Side>[] = [
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
];

const ORDER_TYPES: SegmentOption<OrderType>[] = [
  { value: 'MARKET', label: 'Market' },
  { value: 'LIMIT', label: 'Limit' },
  { value: 'SL', label: 'Stop-loss' },
];

/** One line under the order type that says what it does. */
const TYPE_HINTS: Record<OrderType, string> = {
  MARKET: 'Fills at the next trade price.',
  LIMIT: 'Fills only at your price or better.',
  SL: 'Becomes a limit order once the trigger trades.',
};

/** The outcome of the last submit, shown under the button. */
interface Notice {
  ok: boolean;
  text: string;
}

/** Paper-trading order entry for the selected symbol. */
export function OrderTicket() {
  const symbol = useSelected();

  return (
    <Panel title="Order ticket" aside={symbol ? <TicketQuote symbol={symbol} /> : null}>
      {symbol ? (
        // key={symbol}: choosing another symbol mounts a fresh form, so a limit
        // price typed for TCS can never be sent for INFY.
        <OrderForm key={symbol} symbol={symbol} />
      ) : (
        <EmptyState title="No symbol selected" hint="Choose a symbol in the watchlist to place an order." />
      )}
    </Panel>
  );
}

/** The symbol and its last price, in the title bar. A placeholder until the first trade. */
function TicketQuote({ symbol }: { symbol: string }) {
  const lastPrice = useMarketStore((s) => s.quotes[symbol]?.last);

  return (
    <p className="flex items-baseline gap-2 text-[11px] text-muted">
      {symbol}
      {lastPrice === undefined ? (
        <Skeleton className="h-3 w-14" />
      ) : (
        <span className="font-mono text-xs text-fg tabular-nums">{formatPrice(symbol, lastPrice)}</span>
      )}
    </p>
  );
}

/**
 * The form itself. Its state is a TicketForm, a discriminated union (see
 * ticketForm.ts), so choosing an order type changes which fields exist.
 *
 * On submit: typed strings → toOrderRequest() → validateOrder() → placeOrder().
 * A validation problem appears inline above the button; the store's answer
 * (placed or rejected) is announced in the role="status" line below it.
 */
function OrderForm({ symbol }: { symbol: string }) {
  const [side, setSide] = useState<Side>('BUY');
  const [form, setForm] = useState<TicketForm>({ type: 'MARKET', qty: '1' });
  // Validation messages stay hidden until the first submit, then follow every edit.
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const errorId = useId();

  // The only live market value the form needs. The selector returns a plain
  // number, so the form re-renders when this symbol's price changes and never
  // because of another symbol's trades.
  const lastPrice = useMarketStore((s) => s.quotes[symbol]?.last);
  const placeOrder = useOrderStore((s) => s.placeOrder);

  const request = toOrderRequest(form, side, symbol);
  const error = submitted ? validateOrder(request, lastPrice) : null;
  const waitingForPrice = lastPrice === undefined;

  // What the order is worth at the price it is meant to fill at.
  const fillPrice = form.type === 'MARKET' ? lastPrice : parseAmount(form.price);
  const orderValue = fillPrice === undefined ? NaN : request.qty * fillPrice;

  function changeType(type: OrderType) {
    const startPrice = lastPrice === undefined ? '' : priceInputValue(symbol, lastPrice);
    setForm((current) => changeOrderType(current, type, startPrice));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validateOrder(request, lastPrice) !== null) {
      setSubmitted(true); // The message itself is worked out during render, above.
      setNotice(null);
      return;
    }

    const result = placeOrder(request);
    setSubmitted(false);
    setNotice(
      result.ok
        ? { ok: true, text: `Order placed: ${describeOrder(result.order.req)}.` }
        : { ok: false, text: `Order rejected: ${result.error}` },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 p-3">
      <Segmented
        legend="Side"
        options={SIDES}
        value={side}
        onChange={setSide}
        checkedClassName={(value) => (value === 'BUY' ? 'bg-up text-ink' : 'bg-down text-ink')}
      />

      <div className="flex flex-col gap-1.5">
        <Segmented legend="Order type" options={ORDER_TYPES} value={form.type} onChange={changeType} />
        <p className="text-[11px] text-muted">{TYPE_HINTS[form.type]}</p>
      </div>

      <div className="flex flex-col gap-2">
        <AmountField label="Quantity" value={form.qty} onChange={(qty) => setForm({ ...form, qty })} />
        {/* TypeScript narrows `form` inside each check: only an SL form has a
            trigger, and only LIMIT and SL forms have a price. */}
        {form.type === 'SL' && (
          <AmountField
            label="Trigger price"
            value={form.trigger}
            onChange={(trigger) => setForm({ ...form, trigger })}
          />
        )}
        {form.type !== 'MARKET' && (
          <AmountField label="Limit price" value={form.price} onChange={(price) => setForm({ ...form, price })} />
        )}
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">Order value</span>
        <span className="font-mono tabular-nums">
          {Number.isFinite(orderValue) ? `≈ ${formatMoney(symbol, orderValue)}` : '–'}
        </span>
      </div>

      {error && (
        <p id={errorId} role="alert" className="rounded border border-down/40 bg-down/10 px-2 py-1.5 text-xs text-down">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={waitingForPrice}
        aria-describedby={error ? errorId : undefined}
        className={`flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold text-ink transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted disabled:hover:brightness-100 ${side === 'BUY' ? 'bg-up' : 'bg-down'}`}
      >
        {waitingForPrice ? (
          <>
            <span
              aria-hidden="true"
              className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
            />
            Waiting for price…
          </>
        ) : (
          `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`
        )}
      </button>

      {/* Always rendered, so screen readers announce each new message in it. */}
      <p role="status" className={`text-xs ${notice?.ok ? 'text-up' : 'text-down'}`}>
        {notice?.text}
      </p>
    </form>
  );
}

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A labelled text box for a quantity or a price. */
function AmountField({ label, value, onChange }: AmountFieldProps) {
  const id = useId();

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {/* A text box that opens the number keyboard on phones. type="number"
          would change the value when the mouse wheel scrolls over it. */}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border border-line bg-ink px-2 text-right font-mono text-sm tabular-nums"
      />
    </div>
  );
}
