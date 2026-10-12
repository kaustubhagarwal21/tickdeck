import type { OrderRequest, Side } from '@tickdeck/core';

/** The order ticket's inputs. Text fields hold what the user typed. */
export interface OrderForm {
  side: Side;
  type: OrderRequest['type'];
  qty: string;
  price: string;
  trigger: string;
}

export const initialOrderForm: OrderForm = { side: 'BUY', type: 'MARKET', qty: '1', price: '', trigger: '' };

/**
 * Turns the form into the shared OrderRequest. Text becomes numbers with
 * Number(), so an empty or invalid field becomes 0 or NaN, which
 * validateOrder from @tickdeck/core then reports with a clear message.
 */
export function toOrderRequest(form: OrderForm, symbol: string): OrderRequest {
  const qty = Number(form.qty);
  switch (form.type) {
    case 'MARKET':
      return { type: 'MARKET', side: form.side, symbol, qty };
    case 'LIMIT':
      return { type: 'LIMIT', side: form.side, symbol, qty, price: Number(form.price) };
    case 'SL':
      return { type: 'SL', side: form.side, symbol, qty, price: Number(form.price), trigger: Number(form.trigger) };
  }
}
