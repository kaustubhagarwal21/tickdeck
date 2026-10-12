'use client';

/**
 * Candlestick chart for the selected symbol, with optional SMA and VWAP lines,
 * drawn with TradingView's lightweight-charts (a <canvas> charting library).
 *
 * How it keeps up when hundreds of trades arrive per second:
 * 1. The chart is created once, when the component mounts.
 * 2. When the symbol or the interval changes, every candle is rebuilt from the
 *    store's tick buffer and drawn with setData(): one full redraw.
 * 3. After that, trades never re-render React. The component listens to the
 *    store with useMarketStore.subscribe(), and at most once per animation
 *    frame it folds only the new ticks into the candles and calls
 *    series.update() for the bars that changed. update() redraws one bar,
 *    while setData() would reprocess the whole series.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { formatPrice, priceDecimals } from '@/components/common/format';
import { applyTick, buildCandles } from '@/lib/candles/aggregate';
import { sma, vwap, type LinePoint } from '@/lib/candles/indicators';
import type { Candle, Interval, Tick } from '@/lib/types';
import { useMarketStore } from '@/store/marketStore';
import { useSelected } from '@/store/selectors';
import {
  CANDLE_SERIES_OPTIONS,
  CHART_OPTIONS,
  priceFormat,
  SMA_COLOR,
  SMA_PERIOD,
  SMA_SERIES_OPTIONS,
  VWAP_COLOR,
  VWAP_SERIES_OPTIONS,
} from './chartOptions';
import { IntervalPicker } from './IntervalPicker';

/** The screen-reader summary changes at most this often, so it does not talk over everything else. */
export const SUMMARY_EVERY_MS = 10_000;

/** Interval names for sentences, e.g. "1-minute candles". */
const INTERVAL_NAMES: Record<Interval, string> = {
  '1s': '1-second',
  '5s': '5-second',
  '1m': '1-minute',
};

/** The chart and its three series, created once per mount. */
interface ChartParts {
  chart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  sma: ISeriesApi<'Line'>;
  vwap: ISeriesApi<'Line'>;
}

export function PriceChart() {
  const symbol = useSelected();
  const [interval, setChartInterval] = useState<Interval>('1s');
  const [showSma, setShowSma] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [summary, setSummary] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<ChartParts | null>(null);

  // 1. Create the chart once, and destroy it when the component unmounts.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, CHART_OPTIONS);
    partsRef.current = {
      chart,
      candles: chart.addSeries(CandlestickSeries, CANDLE_SERIES_OPTIONS),
      sma: chart.addSeries(LineSeries, SMA_SERIES_OPTIONS),
      vwap: chart.addSeries(LineSeries, VWAP_SERIES_OPTIONS),
    };

    return () => {
      partsRef.current = null;
      chart.remove();
    };
  }, []);

  // 2. Show or hide the indicator lines. A hidden line still receives data, so
  //    it is up to date the moment it is shown again.
  useEffect(() => {
    partsRef.current?.sma.applyOptions({ visible: showSma });
  }, [showSma]);

  useEffect(() => {
    partsRef.current?.vwap.applyOptions({ visible: showVwap });
  }, [showVwap]);

  // 3. Draw the data: a full redraw now, then live updates until the symbol or
  //    interval changes (React then runs the cleanup and this effect again).
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts || !symbol) return;

    // Working state for this symbol and interval. These are plain variables,
    // not React state, because changing them must not re-render the component.
    let candles: Candle[] = [];
    let lastTick: Tick | undefined; // the newest tick already drawn
    let precision = 0; // decimals shown on the price scale; 0 until the first price
    let frame = 0; // id of the pending animation frame; 0 when none is pending
    let summaryTimer: ReturnType<typeof setTimeout> | undefined;

    // The helpers below are arrow functions rather than `function` declarations:
    // declarations are hoisted above the null check, so inside them TypeScript
    // could no longer tell that `parts` is not null.
    const readTicks = () => useMarketStore.getState().ticksBySymbol[symbol] ?? [];

    /**
     * Shows as many decimals as the rest of the app does for this price (5 for
     * DOGE at 0.2). Only touches the chart when that number changes.
     */
    const matchPricePrecision = () => {
      const last = candles[candles.length - 1];
      if (!last || priceDecimals(symbol, last.close) === precision) return;

      precision = priceDecimals(symbol, last.close);
      const options = { priceFormat: priceFormat(precision) };
      parts.candles.applyOptions(options);
      parts.sma.applyOptions(options);
      parts.vwap.applyOptions(options);
    };

    /** Refreshes the screen-reader summary once SUMMARY_EVERY_MS has passed, with the data as it is then. */
    const scheduleSummary = () => {
      if (summaryTimer !== undefined) return;
      summaryTimer = setTimeout(() => {
        summaryTimer = undefined;
        setSummary(summarize(symbol, interval, candles));
      }, SUMMARY_EVERY_MS);
    };

    /** Rebuilds every candle from the tick buffer and replaces all chart data. */
    const redrawAll = () => {
      const ticks = readTicks();
      candles = buildCandles(ticks, interval);
      lastTick = ticks[ticks.length - 1];

      parts.candles.setData(candles.map(toBar));
      parts.sma.setData(sma(candles, SMA_PERIOD).map(toLine));
      parts.vwap.setData(vwap(candles).map(toLine));
      parts.chart.timeScale().scrollToRealTime();
      matchPricePrecision();
      setSummary(summarize(symbol, interval, candles));
    };

    /** Adds the ticks that arrived since the last frame and redraws only the bars that changed. */
    const drawNewTicks = () => {
      frame = 0;
      const ticks = readTicks();
      const fresh = ticksAfter(ticks, lastTick);
      if (fresh === null) {
        // Our newest tick is no longer in the buffer, so the store was reset: start over.
        redrawAll();
        return;
      }
      if (fresh.length === 0) return; // the store changed, but not for this symbol

      const previousLastTime = candles.length > 0 ? candles[candles.length - 1].time : -Infinity;
      for (const tick of fresh) {
        candles = applyTick(candles, tick, interval);
      }
      lastTick = ticks[ticks.length - 1];

      // The candle that was newest before these ticks may have changed, and any
      // candles after it are new. update() replaces the bar with the same time or
      // appends a later one, so sending exactly those bars, in order, is enough.
      const changed = (point: { time: number }) => point.time >= previousLastTime;
      for (const candle of candles.filter(changed)) parts.candles.update(toBar(candle));
      // The indicators are recomputed over the candles in memory (at most 600, so
      // this takes microseconds), but only their changed points go to the chart.
      for (const point of sma(candles, SMA_PERIOD).filter(changed)) parts.sma.update(toLine(point));
      for (const point of vwap(candles).filter(changed)) parts.vwap.update(toLine(point));

      matchPricePrecision();
      scheduleSummary();
    };

    redrawAll();

    // Each store change asks for one drawNewTicks() in the next animation frame.
    // However many changes happen before that frame, the chart draws once.
    const unsubscribe = useMarketStore.subscribe(() => {
      if (frame === 0) frame = requestAnimationFrame(drawNewTicks);
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearTimeout(summaryTimer);
    };
  }, [symbol, interval]);

  // For example "RELIANCE candlestick chart, 1-second candles, with SMA 20 and VWAP".
  const lines = [showSma && `SMA ${SMA_PERIOD}`, showVwap && 'VWAP'].filter(Boolean).join(' and ');
  const chartLabel = symbol
    ? `${symbol} candlestick chart, ${INTERVAL_NAMES[interval]} candles${lines ? `, with ${lines}` : ''}`
    : 'Price chart, waiting for market data';

  return (
    <div className="flex h-full min-h-64 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {symbol && <span className="mr-1 text-sm font-semibold text-slate-100">{symbol}</span>}
        <IntervalPicker value={interval} onChange={setChartInterval} />
        <IndicatorToggle
          label={`SMA ${SMA_PERIOD}`}
          color={SMA_COLOR}
          pressed={showSma}
          onToggle={() => setShowSma((on) => !on)}
        />
        <IndicatorToggle
          label="VWAP"
          color={VWAP_COLOR}
          pressed={showVwap}
          onToggle={() => setShowVwap((on) => !on)}
        />
        {/* Credit required by the chart library's licence (see chartOptions.ts). */}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-slate-500 hover:text-slate-300"
        >
          TradingView Lightweight Charts™
        </a>
      </div>

      {/* The chart sizes itself to the outer box. The inner box is absolutely
          positioned so the canvas cannot push the layout taller. role="img"
          hides the canvas internals from screen readers; the label describes it. */}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} role="img" aria-label={chartLabel} className="absolute inset-0" />
      </div>

      {/* Not shown on screen. Screen readers announce it whenever it changes. */}
      <p role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>
    </div>
  );
}

interface IndicatorToggleProps {
  label: string;
  color: string;
  pressed: boolean;
  onToggle: () => void;
}

/** Shows or hides one indicator line. aria-pressed tells screen readers whether it is on. */
function IndicatorToggle({ label, color, pressed, onToggle }: IndicatorToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-slate-500 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-sky-400 aria-pressed:bg-slate-800 aria-pressed:text-slate-100"
    >
      {/* Colour key: the same colour as the line on the chart. */}
      <span
        aria-hidden="true"
        className="h-0.5 w-3 rounded-full"
        style={{ backgroundColor: color, opacity: pressed ? 1 : 0.4 }}
      />
      {label}
    </button>
  );
}

// lightweight-charts uses its own "branded" number type, UTCTimestamp, for
// times. Our candle times are exactly that (UTC seconds), so the casts are safe.
function toBar(candle: Candle): CandlestickData<UTCTimestamp> {
  const { open, high, low, close } = candle;
  return { time: candle.time as UTCTimestamp, open, high, low, close };
}

function toLine(point: LinePoint): LineData<UTCTimestamp> {
  return { time: point.time as UTCTimestamp, value: point.value };
}

/**
 * The ticks that arrived after `last`, the newest tick already drawn.
 *
 * It searches from the end of the buffer, so the usual case only looks at the
 * new ticks. Returns null when `last` is no longer in the buffer: the store
 * was reset, or so many ticks arrived that the ring buffer dropped it.
 */
function ticksAfter(ticks: Tick[], last: Tick | undefined): Tick[] | null {
  if (!last) return ticks;
  const index = ticks.lastIndexOf(last);
  return index === -1 ? null : ticks.slice(index + 1);
}

/**
 * The summary sentence screen readers hear, for example:
 * "RELIANCE, 1-second candles: last 1,452.30, high 1,460.00, low 1,440.00 across 42 candles."
 */
function summarize(symbol: string, interval: Interval, candles: Candle[]): string {
  if (candles.length === 0) return `${symbol}: waiting for trades.`;

  let high = -Infinity;
  let low = Infinity;
  for (const candle of candles) {
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
  }
  const last = candles[candles.length - 1].close;
  const price = (value: number) => formatPrice(symbol, value);
  const count = candles.length === 1 ? '1 candle' : `${candles.length} candles`;

  return `${symbol}, ${INTERVAL_NAMES[interval]} candles: last ${price(last)}, high ${price(high)}, low ${price(low)} across ${count}.`;
}
