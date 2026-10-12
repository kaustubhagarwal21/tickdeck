import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CandlestickSeries, createChart, LineSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { Tick } from '@tickdeck/core';
import { useMarketStore } from '@/store/marketStore';
import { PriceChart, SUMMARY_EVERY_MS } from '../PriceChart';

// jsdom cannot draw on a <canvas>, so Jest swaps lightweight-charts for
// __mocks__/lightweight-charts.ts, whose methods are all jest.fn(). These tests
// check which chart methods PriceChart calls, and with what data.

// 12 Oct 2026, 09:15:00 IST: a whole minute, so also the start of 1s and 5s buckets.
const T0_MS = Date.UTC(2026, 9, 12, 3, 45, 0);
const T0 = T0_MS / 1000;

const initialState = useMarketStore.getState();

function tick(symbol: string, offsetMs: number, price: number, qty = 1): Tick {
  return { symbol, price, qty, ts: T0_MS + offsetMs };
}

/** Appends ticks to their symbols' buffers in the store, as the feed does. */
function addTicks(...ticks: Tick[]) {
  act(() => {
    useMarketStore.setState((state) => {
      const ticksBySymbol = { ...state.ticksBySymbol };
      for (const t of ticks) {
        ticksBySymbol[t.symbol] = [...(ticksBySymbol[t.symbol] ?? []), t];
      }
      return { ticksBySymbol };
    });
  });
}

/** Runs the callbacks waiting for the next animation frame (timers are fake). */
function nextFrame() {
  act(() => {
    jest.advanceTimersToNextFrame();
  });
}

/**
 * The mocked chart, and the series PriceChart added to it. A mock's recorded
 * results are typed `any`, so they are cast back to the library's real types.
 */
function chartParts() {
  const chart = jest.mocked(createChart).mock.results[0].value as IChartApi;
  const { calls, results } = jest.mocked(chart.addSeries).mock;
  const seriesWhere = (matches: (call: (typeof calls)[number]) => boolean) =>
    results[calls.findIndex(matches)].value;

  return {
    chart,
    candles: seriesWhere(([definition]) => definition === CandlestickSeries) as ISeriesApi<'Candlestick'>,
    sma: seriesWhere(([, options]) => options?.title === 'SMA 20') as ISeriesApi<'Line'>,
    vwap: seriesWhere(([, options]) => options?.title === 'VWAP') as ISeriesApi<'Line'>,
  };
}

const setup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

beforeEach(() => {
  jest.useFakeTimers();
  useMarketStore.setState(initialState, true);
  // Three RELIANCE trades: two in the 09:15:00 second, one in 09:15:01.
  useMarketStore.setState({
    selected: 'RELIANCE',
    ticksBySymbol: {
      RELIANCE: [tick('RELIANCE', 0, 1450, 2), tick('RELIANCE', 400, 1456, 1), tick('RELIANCE', 1_200, 1448, 3)],
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PriceChart', () => {
  it('creates one chart with a candlestick series and two indicator lines', () => {
    render(<PriceChart />);
    const { chart } = chartParts();

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(chart.addSeries).toHaveBeenCalledTimes(3);
    expect(chart.addSeries).toHaveBeenCalledWith(CandlestickSeries, expect.anything());
    expect(chart.addSeries).toHaveBeenCalledWith(LineSeries, expect.objectContaining({ title: 'SMA 20' }));
    expect(chart.addSeries).toHaveBeenCalledWith(LineSeries, expect.objectContaining({ title: 'VWAP' }));
  });

  it('draws the existing ticks with one setData() per series', () => {
    render(<PriceChart />);
    const { candles, sma, vwap } = chartParts();

    expect(candles.setData).toHaveBeenCalledTimes(1);
    expect(candles.setData).toHaveBeenCalledWith([
      { time: T0, open: 1450, high: 1456, low: 1450, close: 1456 },
      { time: T0 + 1, open: 1448, high: 1448, low: 1448, close: 1448 },
    ]);
    // Typical prices 1454 (volume 3) and 1448 (volume 3).
    expect(vwap.setData).toHaveBeenCalledWith([
      { time: T0, value: 1454 },
      { time: T0 + 1, value: 1451 },
    ]);
    expect(sma.setData).toHaveBeenCalledWith([]); // SMA 20 needs 20 candles
    expect(candles.update).not.toHaveBeenCalled();
  });

  it('describes the chart for screen readers', () => {
    render(<PriceChart />);

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'RELIANCE candlestick chart, 1-second candles, with SMA 20 and VWAP',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'RELIANCE, 1-second candles: last 1,448.00, high 1,456.00, low 1,448.00 across 2 candles.',
    );
  });

  it('sends new ticks to the chart with update(), not setData()', () => {
    render(<PriceChart />);
    const { candles, vwap } = chartParts();

    addTicks(tick('RELIANCE', 1_500, 1451, 2)); // same second as the newest candle
    expect(candles.update).not.toHaveBeenCalled(); // nothing is drawn before the next frame
    nextFrame();

    expect(candles.update).toHaveBeenCalledTimes(1);
    expect(candles.update).toHaveBeenCalledWith({ time: T0 + 1, open: 1448, high: 1451, low: 1448, close: 1451 });
    // Second candle: typical price (1451 + 1448 + 1451) / 3 = 1450, volume 5.
    // VWAP = (1454 * 3 + 1450 * 5) / 8 = 1451.5
    expect(vwap.update).toHaveBeenCalledWith({ time: T0 + 1, value: 1451.5 });
    expect(candles.setData).toHaveBeenCalledTimes(1); // still only the first draw
  });

  it('draws once per animation frame, however many store updates arrive', () => {
    render(<PriceChart />);
    const { candles } = chartParts();

    addTicks(tick('RELIANCE', 1_300, 1450));
    addTicks(tick('RELIANCE', 1_400, 1449));
    addTicks(tick('RELIANCE', 1_500, 1452));
    nextFrame();

    expect(candles.update).toHaveBeenCalledTimes(1);
    expect(candles.update).toHaveBeenCalledWith({ time: T0 + 1, open: 1448, high: 1452, low: 1448, close: 1452 });
  });

  it('sends every bar a frame touched, oldest first, when ticks span several buckets', () => {
    render(<PriceChart />);
    const { candles } = chartParts();

    addTicks(tick('RELIANCE', 2_100, 1460), tick('RELIANCE', 3_200, 1461), tick('RELIANCE', 4_500, 1462));
    nextFrame();

    // The previous newest bar (T0 + 1) is re-sent in case it changed, then the new ones in order.
    const sentTimes = jest.mocked(candles.update).mock.calls.map(([bar]) => bar.time);
    expect(sentTimes).toEqual([T0 + 1, T0 + 2, T0 + 3, T0 + 4]);
    expect(candles.update).toHaveBeenLastCalledWith({ time: T0 + 4, open: 1462, high: 1462, low: 1462, close: 1462 });
  });

  it('ignores ticks for other symbols', () => {
    render(<PriceChart />);
    const { candles, sma, vwap } = chartParts();

    addTicks(tick('TCS', 1_500, 3100));
    nextFrame();

    expect(candles.update).not.toHaveBeenCalled();
    expect(sma.update).not.toHaveBeenCalled();
    expect(vwap.update).not.toHaveBeenCalled();
  });

  it('updates the SMA line once there are 20 candles', () => {
    // Twenty 1s candles closing at 1, 2, ..., 20: SMA = 210 / 20 = 10.5
    useMarketStore.setState({
      ticksBySymbol: { RELIANCE: Array.from({ length: 20 }, (_, i) => tick('RELIANCE', i * 1_000, i + 1)) },
    });
    render(<PriceChart />);
    const { sma } = chartParts();
    expect(sma.setData).toHaveBeenCalledWith([{ time: T0 + 19, value: 10.5 }]);

    // A 21st candle closing at 41: closes 2..20 and 41 sum to 250, so SMA = 12.5
    addTicks(tick('RELIANCE', 20_000, 41));
    nextFrame();

    expect(sma.update).toHaveBeenLastCalledWith({ time: T0 + 20, value: 12.5 });
  });

  it('rebuilds with setData() when the interval changes, and keeps the same chart', async () => {
    const user = setup();
    render(<PriceChart />);
    const { candles } = chartParts();

    await user.click(screen.getByRole('radio', { name: '5s' }));

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(candles.setData).toHaveBeenCalledTimes(2);
    expect(candles.setData).toHaveBeenLastCalledWith([{ time: T0, open: 1450, high: 1456, low: 1448, close: 1448 }]);
    expect(candles.update).not.toHaveBeenCalled();
    expect(screen.getByRole('img')).toHaveAccessibleName(/5-second candles/);
  });

  it('rebuilds with setData() when another symbol is selected', () => {
    addTicks(tick('TCS', 0, 3100));
    render(<PriceChart />);
    const { candles } = chartParts();

    act(() => useMarketStore.setState({ selected: 'TCS' }));

    expect(candles.setData).toHaveBeenCalledTimes(2);
    expect(candles.setData).toHaveBeenLastCalledWith([{ time: T0, open: 3100, high: 3100, low: 3100, close: 3100 }]);

    // Trades for the previous symbol no longer reach the chart.
    addTicks(tick('RELIANCE', 1_500, 1460));
    nextFrame();
    expect(candles.update).not.toHaveBeenCalled();
  });

  it('redraws from scratch when the tick buffer is reset', () => {
    render(<PriceChart />);
    const { candles } = chartParts();

    act(() => useMarketStore.setState({ ticksBySymbol: {} }));
    nextFrame();

    expect(candles.setData).toHaveBeenCalledTimes(2);
    expect(candles.setData).toHaveBeenLastCalledWith([]);
  });

  it('shows and hides the indicator lines', async () => {
    const user = setup();
    render(<PriceChart />);
    const { sma, vwap } = chartParts();
    const smaButton = screen.getByRole('button', { name: 'SMA 20' });
    expect(smaButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(smaButton);
    expect(smaButton).toHaveAttribute('aria-pressed', 'false');
    expect(sma.applyOptions).toHaveBeenLastCalledWith({ visible: false });
    expect(screen.getByRole('img')).toHaveAccessibleName('RELIANCE candlestick chart, 1-second candles, with VWAP');

    await user.click(screen.getByRole('button', { name: 'VWAP' }));
    expect(vwap.applyOptions).toHaveBeenLastCalledWith({ visible: false });
    expect(screen.getByRole('img')).toHaveAccessibleName('RELIANCE candlestick chart, 1-second candles');

    await user.click(smaButton);
    expect(sma.applyOptions).toHaveBeenLastCalledWith({ visible: true });
  });

  it(`updates the screen-reader summary at most every ${SUMMARY_EVERY_MS / 1000} seconds`, () => {
    render(<PriceChart />);
    const status = screen.getByRole('status');

    addTicks(tick('RELIANCE', 1_500, 1451, 2));
    nextFrame();
    expect(status).toHaveTextContent('last 1,448.00'); // unchanged for now

    act(() => {
      jest.advanceTimersByTime(SUMMARY_EVERY_MS);
    });
    expect(status).toHaveTextContent(
      'RELIANCE, 1-second candles: last 1,451.00, high 1,456.00, low 1,448.00 across 2 candles.',
    );
  });

  it('shows more decimals for coins priced below 1', () => {
    useMarketStore.setState({ selected: 'DOGEUSDT', ticksBySymbol: { DOGEUSDT: [tick('DOGEUSDT', 0, 0.21234)] } });
    render(<PriceChart />);
    const { candles } = chartParts();

    expect(candles.applyOptions).toHaveBeenCalledWith({
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    });
    expect(screen.getByRole('status')).toHaveTextContent('last 0.21234');
  });

  it('waits for a selected symbol before drawing', () => {
    useMarketStore.setState({ selected: '' });
    render(<PriceChart />);
    const { candles } = chartParts();

    expect(candles.setData).not.toHaveBeenCalled();
    expect(screen.getByRole('img')).toHaveAccessibleName('Price chart, waiting for market data');
  });

  it('removes the chart and stops listening to the store on unmount', () => {
    const { unmount } = render(<PriceChart />);
    const { chart, candles } = chartParts();

    unmount();
    addTicks(tick('RELIANCE', 1_500, 1460));
    nextFrame();

    expect(chart.remove).toHaveBeenCalledTimes(1);
    expect(candles.update).not.toHaveBeenCalled();
  });
});
