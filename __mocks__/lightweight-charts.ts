/**
 * Test double for lightweight-charts. Jest uses it in every test automatically,
 * because a file in the root __mocks__ folder replaces the node_modules package
 * of the same name.
 *
 * Why the real library cannot run under Jest:
 *  1. It ships only ES modules, which Jest's CommonJS runtime cannot load.
 *  2. It draws on <canvas>, which jsdom does not implement.
 *
 * Every chart and series method is a jest.fn(), so a test can render a chart
 * component and then check what it did, for example:
 *   const chart = jest.mocked(createChart).mock.results[0].value;
 *   expect(chart.addSeries).toHaveBeenCalledWith(CandlestickSeries, expect.anything());
 *
 * The dev server, the production build and the Playwright tests all use the
 * real library.
 */

// Series definitions. In v5 you pass one of these to chart.addSeries().
export const CandlestickSeries = { type: 'Candlestick' };
export const LineSeries = { type: 'Line' };
export const HistogramSeries = { type: 'Histogram' };
export const AreaSeries = { type: 'Area' };
export const BarSeries = { type: 'Bar' };
export const BaselineSeries = { type: 'Baseline' };

// Enums, with the same values as the real package.
export const ColorType = { Solid: 'solid', VerticalGradient: 'gradient' } as const;
export const CrosshairMode = { Normal: 0, Magnet: 1, Hidden: 2, MagnetOHLC: 3 } as const;
export const LineStyle = { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 } as const;
export const PriceScaleMode = { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 } as const;

const createPriceScaleApi = () => ({ applyOptions: jest.fn() });

function createSeriesApi(definition: { type: string }) {
  return {
    seriesType: jest.fn(() => definition.type),
    setData: jest.fn(),
    update: jest.fn(),
    applyOptions: jest.fn(),
    priceScale: jest.fn(createPriceScaleApi),
    createPriceLine: jest.fn(() => ({ applyOptions: jest.fn() })),
    removePriceLine: jest.fn(),
  };
}

export const createChart = jest.fn(() => {
  const timeScale = {
    fitContent: jest.fn(),
    scrollToRealTime: jest.fn(),
    applyOptions: jest.fn(),
  };
  return {
    addSeries: jest.fn(createSeriesApi),
    removeSeries: jest.fn(),
    applyOptions: jest.fn(),
    resize: jest.fn(),
    remove: jest.fn(),
    timeScale: jest.fn(() => timeScale),
    priceScale: jest.fn(createPriceScaleApi),
    subscribeCrosshairMove: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
  };
});

export const createSeriesMarkers = jest.fn(() => ({ setMarkers: jest.fn(), detach: jest.fn() }));
