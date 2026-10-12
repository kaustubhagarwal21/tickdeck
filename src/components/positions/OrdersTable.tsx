'use client';

import { memo } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { describeOrder, formatPrice, formatTime } from '@/components/common/format';
import { isWorking } from '@tickdeck/core';
import type { Order, OrderStatus } from '@tickdeck/core';
import { useOrderStore } from '@/store/orderStore';

/** Label and badge colours for each order status. */
const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'border-accent/40 text-accent' },
  TRIGGERED: { label: 'Triggered', className: 'border-accent/40 text-accent' },
  FILLED: { label: 'Filled', className: 'border-up/40 text-up' },
  CANCELLED: { label: 'Cancelled', className: 'border-line text-muted' },
  REJECTED: { label: 'Rejected', className: 'border-down/40 text-down' },
};

/**
 * Working orders first, each with a Cancel button, then the finished ones.
 * The order store keeps `orders` newest first, so no sorting is needed here.
 */
export function OrdersTable({ orders }: { orders: Order[] }) {
  const cancelOrder = useOrderStore((s) => s.cancelOrder);

  if (orders.length === 0) {
    return <EmptyState title="No open orders" hint="Limit and stop-loss orders wait here until they fill." />;
  }

  const working = orders.filter(isWorking);
  const finished = orders.filter((order) => !isWorking(order));

  return (
    <div>
      {working.length > 0 ? (
        <OrderList caption="Open orders" orders={working} onCancel={cancelOrder} />
      ) : (
        <p className="px-3 py-2.5 text-xs text-muted">No open orders</p>
      )}
      {finished.length > 0 && <OrderList caption="Order history" orders={finished} />}
    </div>
  );
}

interface OrderListProps {
  caption: string;
  orders: Order[];
  /** When given, every row gets a Cancel button. */
  onCancel?: (id: string) => void;
}

function OrderList({ caption, orders, onCancel }: OrderListProps) {
  return (
    <table className="w-full text-xs">
      <caption className="px-3 pt-2.5 pb-1 text-left text-[10px] tracking-wider text-muted uppercase">
        {caption}
      </caption>
      {/* Column names for screen readers. On screen, each row explains itself. */}
      <thead className="sr-only">
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Order</th>
          <th scope="col">Status</th>
          {onCancel && <th scope="col">Action</th>}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} onCancel={onCancel} />
        ))}
      </tbody>
    </table>
  );
}

interface OrderRowProps {
  order: Order;
  onCancel?: (id: string) => void;
}

/** One order. memo() skips it unless the store replaced this order object. */
const OrderRow = memo(function OrderRow({ order, onCancel }: OrderRowProps) {
  const description = describeOrder(order.req);
  const badge = STATUS_BADGE[order.status];

  let detail = '';
  if (order.status === 'FILLED' && order.fillPrice !== undefined) {
    detail = `at ${formatPrice(order.req.symbol, order.fillPrice)}`;
  } else if (order.reason) {
    detail = order.reason;
  }

  return (
    <tr className="border-t border-line">
      <td className="w-20 px-3 py-1.5 font-mono text-muted tabular-nums">{formatTime(order.createdAt)}</td>
      <td className="py-1.5 pr-3">{description}</td>
      <td className="py-1.5 pr-3">
        <span className={`rounded-sm border px-1.5 py-px text-[10px] font-medium ${badge.className}`}>
          {badge.label}
        </span>
        {detail && <span className="ml-2 text-muted">{detail}</span>}
      </td>
      {onCancel && (
        <td className="px-3 py-1 text-right">
          <button
            type="button"
            onClick={() => onCancel(order.id)}
            aria-label={`Cancel order: ${description}`}
            className="rounded px-2 py-0.5 text-muted hover:bg-raised hover:text-fg"
          >
            Cancel
          </button>
        </td>
      )}
    </tr>
  );
});
