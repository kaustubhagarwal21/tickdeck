import { act, render, screen } from '@testing-library/react';
import { useMarketStore } from '@/store/marketStore';
import { StatusBar } from '../StatusBar';

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows the feed, its status, ticks in and store commits', () => {
  useMarketStore.setState({
    feedKind: 'binance',
    status: 'open',
    symbols: ['BTCUSDT'],
    metrics: { ticksIn: 5000, commits: 700, lastSecondTicks: 412, lastSecondCommits: 60 },
  });
  render(<StatusBar />);

  expect(screen.getByText('Live data from Binance · Connected')).toBeInTheDocument();
  expect(screen.getByText('ticks/s in')).toHaveTextContent('412 ticks/s in');
  expect(screen.getByText('store commits/s')).toHaveTextContent('60 store commits/s');
});

test('labels the simulated feed as simulated', () => {
  useMarketStore.setState({ feedKind: 'simulated', symbols: ['TCS'] });
  render(<StatusBar />);

  expect(screen.getByText(/^Simulated data/)).toBeInTheDocument();
});

test('measures FPS by counting animation frames over a second', () => {
  // Jest's fake timers also fake requestAnimationFrame (one frame every 16 ms)
  // and performance.now(), so one simulated second is about 60 frames.
  jest.useFakeTimers();
  render(<StatusBar />);
  expect(screen.getByText('FPS')).toHaveTextContent('0 FPS');

  act(() => {
    jest.advanceTimersByTime(1100);
  });

  const fps = Number.parseInt(screen.getByText('FPS').textContent ?? '', 10);
  expect(fps).toBeGreaterThanOrEqual(55);
  expect(fps).toBeLessThanOrEqual(65);
});
