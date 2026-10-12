'use client';

import type { FeedKind, FeedStatus } from '@/lib/types';
import { useFeedKind, useFeedStatus, useSymbols } from '@/store/selectors';
import { FEED_STATUS_TEXT } from './feedStatus';

/** The feeds the toggle offers. `param` is the value of ?feed= in the URL. */
const FEEDS: { kind: FeedKind; param: string; label: string; market: string }[] = [
  { kind: 'binance', param: 'binance', label: 'Live', market: 'Binance' },
  { kind: 'simulated', param: 'sim', label: 'Simulated', market: 'NSE-style' },
];

const STATUS_DOT: Record<FeedStatus, string> = {
  connecting: 'bg-accent animate-pulse motion-reduce:animate-none',
  open: 'bg-up',
  closed: 'bg-muted',
  error: 'bg-down',
};

/** App name, the feed switch and the connection status. */
export function Header() {
  const feedKind = useFeedKind();
  const status = useFeedStatus();
  // The store has no symbols until a feed starts. Until then, no feed is
  // marked as current, so the page never shows a choice that is about to change.
  const started = useSymbols().length > 0;

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel px-4 py-2">
      <Logo />

      {/* On phones the switch moves to a full-width row below the logo and status. */}
      <nav aria-label="Market data feed" className="order-last w-full sm:order-none sm:w-auto">
        <ul className="grid grid-cols-2 gap-0.5 rounded-md bg-ink p-0.5 sm:flex">
          {FEEDS.map((feed) => (
            <li key={feed.kind}>
              {/* A plain <a> rather than next/link, on purpose: switching feeds
                  loads the page afresh, which closes the old socket or worker
                  and starts every store clean. It also lets "Live" retry
                  Binance after a fallback, when the URL has not changed. */}
              <a
                href={`/?feed=${feed.param}`}
                aria-current={started && feed.kind === feedKind ? 'page' : undefined}
                className="flex items-center justify-center gap-1.5 rounded px-3 py-1 text-xs font-medium text-muted hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
              >
                {feed.label}{' '}
                <span className="text-muted">· {feed.market}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* role="status" makes screen readers announce connection changes. */}
      <p
        role="status"
        className="ml-auto flex items-center gap-2 rounded-full border border-line bg-ink px-2.5 py-1 text-xs"
      >
        <span aria-hidden="true" className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className="sr-only">Market feed: </span>
        {FEED_STATUS_TEXT[status]}
      </p>
    </header>
  );
}

/** Three candlesticks and the name. The page's only <h1>. */
function Logo() {
  return (
    <div className="flex items-center gap-2 text-accent">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 4v12" opacity="0.45" />
          <path d="M10 1.5v17" />
          <path d="M16 5.5v9" opacity="0.45" />
        </g>
        <rect x="2.5" y="7" width="3" height="6" rx="0.75" fill="currentColor" opacity="0.45" />
        <rect x="8.5" y="4.5" width="3" height="10" rx="0.75" fill="currentColor" />
        <rect x="14.5" y="8" width="3" height="4" rx="0.75" fill="currentColor" opacity="0.45" />
      </svg>
      <h1 className="text-base font-semibold tracking-[0.12em] text-fg uppercase font-stretch-condensed">
        TickDeck
      </h1>
    </div>
  );
}
