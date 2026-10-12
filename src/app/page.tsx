import { FeedProvider } from '@/components/FeedProvider';
import { ChartPanel } from '@/components/layout/ChartPanel';
import { FeedErrorBanner } from '@/components/layout/FeedErrorBanner';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { OrderBook } from '@/components/orderbook/OrderBook';
import { PositionsPanel } from '@/components/positions/PositionsPanel';
import { OrderTicket } from '@/components/ticket/OrderTicket';
import { Watchlist } from '@/components/watchlist/Watchlist';

/**
 * The trading terminal, TickDeck's only page.
 *
 * This file is a Server Component that only arranges the panels. Each panel is
 * a Client Component that reads the live Zustand stores, and FeedProvider runs
 * the market feed in the browser. The grid itself is `.terminal` in globals.css.
 *
 * On a desktop the page fills the window and each panel scrolls on its own,
 * like a trading terminal. It still fits a 1366x768 laptop, where the browser
 * leaves about 650px for the page; only a window shorter than 40rem (640px)
 * scrolls, instead of squeezing the panels further. On smaller screens the
 * panels stack and the page scrolls as usual.
 */
export default function Home() {
  return (
    <FeedProvider>
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-[40rem]">
        <a
          href="#terminal"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to the trading panels
        </a>
        <Header />
        <FeedErrorBanner />

        <main id="terminal" className="terminal min-h-0 flex-1 p-1.5">
          <div className="min-h-0 [grid-area:watch]">
            <Watchlist />
          </div>
          <div className="h-[28rem] min-h-0 [grid-area:chart] lg:h-auto">
            <ChartPanel />
          </div>
          <div className="flex min-h-0 flex-col gap-1.5 [grid-area:side]">
            <div className="min-h-0 lg:flex-1">
              <OrderBook />
            </div>
            <div className="shrink-0">
              <OrderTicket />
            </div>
          </div>
          <div className="min-h-64 [grid-area:blotter] lg:min-h-0">
            <PositionsPanel />
          </div>
        </main>

        <StatusBar />
      </div>
    </FeedProvider>
  );
}
