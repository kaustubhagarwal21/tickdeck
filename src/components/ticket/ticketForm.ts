import type { OrderRequest, Side } from '@/lib/types';

/** 'MARKET' | 'LIMIT' | 'SL', taken from the shared OrderRequest type. */
export type OrderType = OrderRequest['type'];

/**
 * What the order ticket's inputs hold.
 *
 * Like OrderRequest, this is a discriminated union on `type`. Once code checks
 * `form.type`, TypeScript knows which fields exist: a MARKET form has no price
 * field at all, instead of a price that is quietly ignored. The values are the
 * raw strings from the inputs; toOrderRequest() turns them into numbers.
 */
export type TicketForm =
  | { type: 'MARKET'; qty: string }
  | { type: 'LIMIT'; qty: string; price: string }
  | { type: 'SL'; qty: string; trigger: string; price: string };

/**
 * Switches the form to another order type and keeps whatever the user already
 * typed. A price box that did not exist before starts at `startPrice`
 * (normally the last traded price), so a new limit order begins near the market.
 */
export function changeOrderType(form: TicketForm, type: OrderType, startPrice: string): TicketForm {
  const { qty } = form;
  // The `in` checks narrow the union: only LIMIT and SL forms have a price.
  const price = 'price' in form ? form.price : startPrice;

  switch (type) {
    case 'MARKET':
      return { type, qty };
    case 'LIMIT':
      return { type, qty, price };
    case 'SL':
      return { type, qty, price, trigger: 'trigger' in form ? form.trigger : price };
  }
}

/** Builds the OrderRequest that validateOrder() and placeOrder() expect. */
export function toOrderRequest(form: TicketForm, side: Side, symbol: string): OrderRequest {
  const qty = parseAmount(form.qty);

  switch (form.type) {
    case 'MARKET':
      return { type: 'MARKET', side, symbol, qty };
    case 'LIMIT':
      return { type: 'LIMIT', side, symbol, qty, price: parseAmount(form.price) };
    case 'SL':
      return {
        type: 'SL',
        side,
        symbol,
        qty,
        trigger: parseAmount(form.trigger),
        price: parseAmount(form.price),
      };
  }
}

// Digits with at most one decimal point: "10", "1450.5", ".5" and "5." pass;
// "-5", "1e3" and "0x10" do not, even though Number() would accept them.
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

/**
 * Reads a number the way people type one, so "1,450.50" works. An empty or
 * malformed box becomes NaN rather than 0, which validation then reports.
 */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/,/g, '').trim();
  return DECIMAL.test(cleaned) ? Number(cleaned) : NaN;
}
