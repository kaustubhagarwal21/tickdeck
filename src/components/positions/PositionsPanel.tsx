'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { isWorking } from '@/lib/orders/match';
import { useOrderStore } from '@/store/orderStore';
import { OrdersTable } from './OrdersTable';
import { PositionsTable } from './PositionsTable';

type Tab = 'positions' | 'orders';

const TABS: Tab[] = ['positions', 'orders'];
const TAB_LABELS: Record<Tab, string> = { positions: 'Positions', orders: 'Orders' };

/**
 * The bottom panel: open positions and orders, as two tabs.
 *
 * It follows the WAI-ARIA tabs pattern: the tab row is a single Tab stop, the
 * arrow keys and Home / End switch tabs, and each tab is linked to the panel it
 * shows through aria-controls and aria-labelledby.
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

  const idPrefix = useId();
  const tabId = (t: Tab) => `${idPrefix}tab-${t}`;
  const panelId = (t: Tab) => `${idPrefix}panel-${t}`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.indexOf(tab);
    let next: Tab;
    switch (event.key) {
      case 'ArrowRight':
        next = TABS[(index + 1) % TABS.length];
        break;
      case 'ArrowLeft':
        next = TABS[(index - 1 + TABS.length) % TABS.length];
        break;
      case 'Home':
        next = TABS[0];
        break;
      case 'End':
        next = TABS[TABS.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    setTab(next);
    // Move focus with the selection, the way native tab widgets behave.
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <section
      aria-label="Portfolio"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-panel"
    >
      <div
        role="tablist"
        aria-label="Positions and orders"
        onKeyDown={handleKeyDown}
        className="flex h-9 shrink-0 items-stretch gap-5 border-b border-line px-3"
      >
        {TABS.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={panelId(t)}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase font-stretch-semi-condensed hover:text-fg aria-selected:text-fg aria-selected:shadow-[inset_0_-2px_0_var(--color-accent)]"
          >
            {TAB_LABELS[t]}{' '}
            <span className="rounded-sm bg-raised px-1 font-mono text-[10px] tracking-normal tabular-nums">
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {TABS.map((t) => (
        <div
          key={t}
          id={panelId(t)}
          role="tabpanel"
          aria-labelledby={tabId(t)}
          hidden={tab !== t}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto"
        >
          {/* Only the visible tab renders its rows, so hidden rows never follow live prices. */}
          {tab === t &&
            (t === 'positions' ? <PositionsTable positions={positions} /> : <OrdersTable orders={orders} />)}
        </div>
      ))}
    </section>
  );
}
