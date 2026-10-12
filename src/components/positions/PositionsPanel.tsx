'use client';

import { useState } from 'react';
import { isWorking } from '@tickdeck/core';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useOrderStore } from '@/store/orderStore';
import { OrdersTable } from './OrdersTable';
import { PositionsTable } from './PositionsTable';

type Tab = 'positions' | 'orders';

const TAB_LABELS: Record<Tab, string> = { positions: 'Positions', orders: 'Orders' };

/**
 * The bottom panel: open positions and orders, as two tabs.
 *
 * The shared Tabs component (src/components/ui/Tabs.tsx) brings the WAI-ARIA
 * tabs pattern: the tab row is a single Tab stop, the arrow keys and Home /
 * End switch tabs, and each tab is linked to its panel through aria-controls
 * and aria-labelledby. It renders only the selected tab's rows, so the hidden
 * table never re-renders on live prices.
 */
export function PositionsPanel() {
  const [tab, setTab] = useState<Tab>('positions');
  const positionsBySymbol = useOrderStore((s) => s.positions);
  const orders = useOrderStore((s) => s.orders);

  const positions = Object.values(positionsBySymbol);
  const counts: Record<Tab, number> = {
    positions: positions.length,
    orders: orders.filter(isWorking).length, // open orders only
  };

  const items: TabItem<Tab>[] = (['positions', 'orders'] as const).map((t) => ({
    value: t,
    label: (
      <>
        {TAB_LABELS[t]}{' '}
        <span className="rounded-sm bg-raised px-1 font-mono text-[10px] tracking-normal tabular-nums">
          {counts[t]}
        </span>
      </>
    ),
  }));

  return (
    <section
      aria-label="Portfolio"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-panel"
    >
      <Tabs<Tab>
        label="Positions and orders"
        items={items}
        value={tab}
        onValueChange={setTab}
        className="flex-1"
        panelClassName="overflow-auto"
      >
        {(t) => (t === 'positions' ? <PositionsTable positions={positions} /> : <OrdersTable orders={orders} />)}
      </Tabs>
    </section>
  );
}
