'use client';

import { LazyPriceChart } from '@/components/chart/LazyPriceChart';
import { formatPercent, formatPrice, signColor } from '@/components/common/format';
import { Panel } from '@/components/common/Panel';
import { useQuote, useSelected } from '@/store/selectors';

/**
 * The chart slot in the middle of the terminal. PriceChart brings its own
 * toolbar (symbol, candle interval, indicators); this panel frames it and puts
 * the selected symbol's last price in the title bar. The chart and its library
 * arrive in their own chunk after the page loads (see LazyPriceChart).
 */
export function ChartPanel() {
  return (
    <Panel title="Price chart" aside={<LastPrice />} bodyClassName="p-3">
      <LazyPriceChart />
    </Panel>
  );
}

/** Last price and change of the selected symbol. Only this small part re-renders on each trade. */
function LastPrice() {
  const symbol = useSelected();
  const quote = useQuote(symbol);
  if (!quote) return null;

  return (
    <p className="flex items-baseline gap-2 font-mono tabular-nums">
      <span className="sr-only">{symbol} last price</span>
      <span className="text-sm">{formatPrice(symbol, quote.last)}</span>
      <span className={`text-xs ${signColor(quote.change)}`}>{formatPercent(quote.changePct)}</span>
    </p>
  );
}
