'use client';

import { useFeedKind, useFeedStatus } from '@/store/selectors';

/**
 * Shown while the market feed reports an error. The prices on screen may then
 * be stale, so the banner says so and offers a way to reconnect.
 */
export function FeedErrorBanner() {
  const status = useFeedStatus();
  const feedKind = useFeedKind();

  if (status !== 'error') return null;

  const feedName = feedKind === 'binance' ? 'Binance' : 'simulated';
  const param = feedKind === 'binance' ? 'binance' : 'sim';

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-down/40 bg-down/10 px-4 py-2 text-sm"
    >
      <p>
        <span className="font-semibold text-down">Feed error.</span> The {feedName} feed stopped sending
        prices, so the numbers on screen may be out of date.
      </p>
      {/* A full page load (a plain <a>, not next/link) rebuilds the feed and
          every store from scratch. */}
      <a href={`/?feed=${param}`} className="font-medium underline underline-offset-4 hover:text-accent">
        Retry
      </a>
    </div>
  );
}
