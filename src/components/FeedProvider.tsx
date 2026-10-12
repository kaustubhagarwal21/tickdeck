'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import type { FeedKind, FeedMessage } from '@tickdeck/core';
import { createFeed, parseFeedParams, symbolsFor, type FeedChoice } from '@/lib/feed/createFeed';
import { createRafBatcher } from '@/lib/feed/rafBatcher';
import { DEFAULT_TICKS_PER_SECOND } from '@tickdeck/core';
import { useMarketStore } from '@/store/marketStore';
import { useOrderStore } from '@/store/orderStore';

/** Binance must deliver its first trade or book within this time, or we switch to the simulated feed. */
export const BINANCE_FIRST_DATA_TIMEOUT_MS = 5_000;
/** How often the status-bar metrics are published. */
const METRICS_INTERVAL_MS = 1_000;

/** Used when there is no router to read a URL from, as in unit tests: never touches the network. */
const NO_URL_CHOICE: FeedChoice = { kind: 'simulated', ticksPerSecond: DEFAULT_TICKS_PER_SECOND };

/**
 * Connects the market feed chosen in the URL (?feed=sim|binance, ?rate=N) to
 * the stores. The stores are global, so this component provides no React
 * context: it only runs the feed while it is mounted, and renders its children.
 */
export function FeedProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {/* useSearchParams() makes a component render only in the browser on a
          static page, and Next.js requires a Suspense boundary around it. This
          boundary keeps the rest of the page in the prerendered HTML. */}
      <Suspense fallback={null}>
        <FeedFromUrl />
      </Suspense>
      {children}
    </>
  );
}

/** Reads the feed choice from the URL. Renders nothing. */
function FeedFromUrl() {
  // Typed as nullable because, outside the Next.js router (in unit tests), the hook returns null.
  const searchParams: ReadonlyURLSearchParams | null = useSearchParams();
  const { kind, ticksPerSecond } = searchParams ? parseFeedParams(searchParams) : NO_URL_CHOICE;

  // A new key mounts a fresh FeedConnection when the URL asks for a different
  // feed. That cleans up the old feed and also clears an earlier fallback.
  return <FeedConnection key={`${kind}@${ticksPerSecond}`} requested={kind} ticksPerSecond={ticksPerSecond} />;
}

/** Runs one feed: messages → frame batcher → stores. Renders nothing. */
function FeedConnection({ requested, ticksPerSecond }: { requested: FeedKind; ticksPerSecond: number }) {
  // Set when Binance fails before sending any data; this connection then runs the simulated feed.
  const [fellBack, setFellBack] = useState(false);
  const kind: FeedKind = fellBack ? 'simulated' : requested;

  useEffect(() => {
    const symbols = symbolsFor(kind);
    useMarketStore.getState().reset(kind, symbols);

    // At most one store commit per animation frame, however many messages arrive.
    const batcher = createRafBatcher<FeedMessage>((messages) => {
      useMarketStore.getState().applyBatch(messages);
      const { onTick } = useOrderStore.getState();
      for (const message of messages) {
        if (message.kind === 'tick') onTick(message.tick);
      }
    });

    // Binance has to prove it works: an error or 5 s of silence before its
    // first trade or book switches to the simulated feed. After that, outages
    // are left to the feed's own reconnect with backoff.
    let waitingForFirstData = kind === 'binance';
    const fallBack = (reason: string) => {
      if (!waitingForFirstData) return;
      waitingForFirstData = false;
      console.info(`Binance feed unavailable (${reason}). Switching to the simulated feed.`);
      setFellBack(true);
    };

    const feed = createFeed(kind, { ticksPerSecond });
    const unsubscribe = feed.onMessage((message) => {
      if (message.kind !== 'status') waitingForFirstData = false;
      else if (message.status === 'error') fallBack(message.detail ?? 'connection error');
      batcher.push(message);
    });
    feed.connect(symbols);

    const firstDataTimer =
      kind === 'binance'
        ? window.setTimeout(
            () => fallBack(`no data within ${BINANCE_FIRST_DATA_TIMEOUT_MS / 1000} s`),
            BINANCE_FIRST_DATA_TIMEOUT_MS,
          )
        : undefined;
    const metricsTimer = window.setInterval(
      () => useMarketStore.getState().sampleMetrics(),
      METRICS_INTERVAL_MS,
    );

    return () => {
      window.clearTimeout(firstDataTimer);
      window.clearInterval(metricsTimer);
      unsubscribe();
      feed.disconnect();
      batcher.dispose();
    };
  }, [kind, ticksPerSecond]);

  return null;
}
