'use client';

import dynamic from 'next/dynamic';
import { ChartPanel } from '@/components/layout/ChartPanel';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

type CenterView = 'chart' | 'chain';

const VIEWS: readonly TabItem<CenterView>[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'chain', label: 'Option chain' },
];

/**
 * The option chain is only needed once someone opens its tab, so next/dynamic
 * gives it its own chunk, fetched on first use. `ssr: false` because it is
 * never on screen when the page loads (the Chart tab is), and next/dynamic
 * allows that option only in a Client Component like this one.
 */
const OptionChainPanel = dynamic(
  () => import('@/components/optionchain/OptionChainPanel').then((mod) => mod.OptionChainPanel),
  {
    ssr: false,
    loading: () => <p className="p-3 text-xs text-muted">Loading option chain…</p>,
  },
);

/**
 * The middle of the terminal: the price chart or the option chain, picked
 * with a tab row (WAI-ARIA tabs: one Tab stop, arrow keys, Home / End).
 *
 * Each tab shows a whole panel card with its own heading, so "Price chart" and
 * "Option chain" stay named landmarks for screen readers. Tabs renders only
 * the selected panel, so the hidden one does no work on live prices; the chart
 * is rebuilt from the candles in the store when its tab comes back.
 */
export function CenterPanel() {
  return (
    <Tabs<CenterView> label="Chart or option chain" items={VIEWS} className="h-full" panelClassName="pt-1.5">
      {(view) => (view === 'chart' ? <ChartPanel /> : <OptionChainPanel />)}
    </Tabs>
  );
}
