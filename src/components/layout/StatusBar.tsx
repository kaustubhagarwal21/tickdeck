'use client';

import type { FeedKind } from '@tickdeck/core';
import { useFeedKind, useFeedStatus, useMetrics, useSymbols } from '@/store/selectors';
import { FEED_STATUS_TEXT } from './feedStatus';
import { useFps } from './useFps';

const FEED_TEXT: Record<FeedKind, string> = {
  binance: 'Live data from Binance',
  simulated: 'Simulated data: NSE-style prices generated in your browser',
};

/**
 * The bar along the bottom of the screen. Its left side names the feed and
 * its connection status.
 *
 * Its right side shows the app's data pipeline as three live numbers:
 *   trades in per second → store commits per second → frames painted per second.
 * The frame batcher turns any number of trades into at most one store commit
 * per animation frame. So on a busy feed the first number is far larger than
 * the second, while the third stays near the screen's refresh rate.
 */
export function StatusBar() {
  const feedKind = useFeedKind();
  const status = useFeedStatus();
  // The store has no symbols until a feed starts. Until then, say nothing
  // about which feed it is rather than show a label that is about to change.
  const started = useSymbols().length > 0;
  // Published once a second by FeedProvider, so these re-render the bar once
  // a second, not on every store commit.
  const { lastSecondTicks, lastSecondCommits } = useMetrics();
  const fps = useFps();

  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line bg-panel px-4 py-1.5 text-[11px] text-muted">
      <p>
        {started ? `${FEED_TEXT[feedKind]} · ${FEED_STATUS_TEXT[status]}` : 'Connecting to the market feed…'}
      </p>
      <p className="flex items-center gap-2 font-mono tabular-nums">
        <Stat value={lastSecondTicks} label="ticks/s in" />
        <Arrow />
        <Stat value={lastSecondCommits} label="store commits/s" />
        <Arrow />
        <Stat value={fps} label="FPS" />
      </p>
    </footer>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="text-fg">{value}</span> {label}
    </span>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="text-accent">
      →
    </span>
  );
}
