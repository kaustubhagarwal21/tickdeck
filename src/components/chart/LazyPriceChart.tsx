'use client';

/**
 * PriceChart, loaded on demand.
 *
 * lightweight-charts is the biggest library on the page, and the chart cannot
 * draw anything until the browser runs it anyway (it paints on a <canvas>).
 * next/dynamic moves PriceChart and the chart library into their own
 * JavaScript chunk, which the browser fetches after the first-load bundle, so
 * the rest of the dashboard (watchlist, order book, ticket) is ready sooner.
 *
 * `ssr: false` skips PriceChart on the server: the prerendered HTML holds the
 * skeleton below, and the browser swaps in the real chart once its chunk has
 * arrived. next/dynamic allows `ssr: false` only in a Client Component, which
 * is why this file starts with 'use client'.
 */
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/common/Skeleton';

export const LazyPriceChart = dynamic(() => import('./PriceChart').then((mod) => mod.PriceChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

/**
 * Stands in for PriceChart while its chunk loads. The outer box uses the same
 * classes as PriceChart's, so the chart fills exactly the space the skeleton
 * held and nothing else on the page moves when it arrives (no layout shift).
 * The toolbar row is as tall as the real one (24px, the interval picker).
 */
export function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-64 flex-col gap-2">
      <p className="sr-only">Loading price chart…</p>
      <div className="flex h-6 items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="relative min-h-0 flex-1">
        <Skeleton className="absolute inset-0 rounded-md" />
      </div>
    </div>
  );
}
