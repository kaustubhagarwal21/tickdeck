/**
 * Look and formatting of the price chart: the lightweight-charts options that
 * PriceChart passes in. They live here so PriceChart.tsx is only about behaviour.
 *
 * Colours come from Tailwind's default palette: slate for the frame, green and
 * red candles, amber and sky for the indicator lines.
 */
import {
  ColorType,
  TickMarkType,
  type CandlestickSeriesPartialOptions,
  type ChartOptions,
  type DeepPartial,
  type LineSeriesPartialOptions,
  type PriceFormatBuiltIn,
  type Time,
} from 'lightweight-charts';

const SLATE_400 = '#94a3b8';
const SLATE_500 = '#64748b';
const SLATE_700 = '#334155';
const SLATE_800 = '#1e293b';
const GREEN_500 = '#22c55e';
const RED_500 = '#ef4444';

/** Line colours, also used for the colour keys on the indicator toggles. */
export const SMA_COLOR = '#fbbf24'; // amber-400
export const VWAP_COLOR = '#38bdf8'; // sky-400

/** Number of candles the moving average covers. */
export const SMA_PERIOD = 20;

// --- Time labels ------------------------------------------------------------
// Candle times are UTC seconds, and lightweight-charts would print them in UTC.
// These formatters print the viewer's local time instead, so the NSE open shows
// as 09:15 for someone in India rather than 03:45. Intl formatters are slow to
// create, so each one is created once here and reused for every label.

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const clockWithSeconds = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const dayAndMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dateAndClock = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// PriceChart only ever gives the chart UTC timestamps in seconds (Candle.time),
// so every `time` the chart hands back is one of those numbers.
const toDate = (time: Time) => new Date((time as number) * 1000);

/** Label for a tick mark on the time axis. */
function formatTickMark(time: Time, type: TickMarkType): string {
  if (type === TickMarkType.TimeWithSeconds) return clockWithSeconds.format(toDate(time));
  if (type === TickMarkType.Time) return clock.format(toDate(time));
  // Year, Month and DayOfMonth marks: the first mark of a new day shows the date.
  return dayAndMonth.format(toDate(time));
}

// --- Chart and series options -----------------------------------------------

export const CHART_OPTIONS: DeepPartial<ChartOptions> = {
  // Resize with the container element. lightweight-charts watches it with a ResizeObserver.
  autoSize: true,
  layout: {
    // Transparent, so the chart takes the background of the panel it sits in.
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: SLATE_400,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    // The library's licence (Apache-2.0) asks for its attribution notice,
    // "TradingView Lightweight Charts™, Copyright (c) TradingView, Inc.
    // https://www.tradingview.com/", and a link to tradingview.com on the page.
    // PriceChart shows that as a text link instead of this logo, because the
    // logo is a focusable link inside the chart's role="img" element, which
    // screen readers cannot reach.
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: SLATE_800 },
    horzLines: { color: SLATE_800 },
  },
  crosshair: {
    vertLine: { color: SLATE_500, labelBackgroundColor: SLATE_700 },
    horzLine: { color: SLATE_500, labelBackgroundColor: SLATE_700 },
  },
  rightPriceScale: { borderColor: SLATE_700 },
  timeScale: {
    borderColor: SLATE_700,
    timeVisible: true,
    secondsVisible: true,
    // Leave space for 5 candles to the right of the newest one.
    rightOffset: 5,
    tickMarkFormatter: formatTickMark,
  },
  localization: {
    // The time label under the crosshair.
    timeFormatter: (time: Time) => dateAndClock.format(toDate(time)),
  },
};

export const CANDLE_SERIES_OPTIONS: CandlestickSeriesPartialOptions = {
  upColor: GREEN_500,
  downColor: RED_500,
  wickUpColor: GREEN_500,
  wickDownColor: RED_500,
  borderVisible: false,
};

/** Shared by both indicator lines: no horizontal "last value" line, no hover dot. */
const INDICATOR_LINE: LineSeriesPartialOptions = {
  lineWidth: 2,
  priceLineVisible: false,
  crosshairMarkerVisible: false,
};

// `title` labels each line's current value on the price scale.
export const SMA_SERIES_OPTIONS: LineSeriesPartialOptions = {
  ...INDICATOR_LINE,
  color: SMA_COLOR,
  title: `SMA ${SMA_PERIOD}`,
};

export const VWAP_SERIES_OPTIONS: LineSeriesPartialOptions = {
  ...INDICATOR_LINE,
  color: VWAP_COLOR,
  title: 'VWAP',
};

// --- Prices -------------------------------------------------------------------

/**
 * Price-scale format with `precision` decimals. minMove (the smallest price
 * step) must match the precision, or prices get rounded to the default 0.01.
 * PriceChart picks the precision with priceDecimals() from common/format.ts,
 * so the chart shows the same decimals as the rest of the app.
 */
export function priceFormat(precision: number): PriceFormatBuiltIn {
  return { type: 'price', precision, minMove: 1 / 10 ** precision };
}
