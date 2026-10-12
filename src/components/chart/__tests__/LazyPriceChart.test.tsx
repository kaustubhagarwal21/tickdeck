import { render, screen } from '@testing-library/react';
import { ChartSkeleton, LazyPriceChart } from '../LazyPriceChart';
import { PriceChart } from '../PriceChart';

// As in every test, lightweight-charts is the stub in __mocks__/lightweight-charts.ts,
// so the real PriceChart can mount in jsdom.

it('shows the skeleton first, then swaps in the real chart once its chunk has loaded', async () => {
  render(<LazyPriceChart />);

  expect(screen.getByText('Loading price chart…')).toBeInTheDocument();

  // PriceChart's canvas box is the only element with role="img".
  expect(await screen.findByRole('img', { name: /chart/i })).toBeInTheDocument();
  expect(screen.queryByText('Loading price chart…')).not.toBeInTheDocument();
});

it('gives the skeleton the same outer box as the chart, so nothing moves when the chart arrives', () => {
  // jsdom does no layout, so compare the classes that size the box. If this
  // fails, PriceChart's outer classes changed: copy them to ChartSkeleton.
  const skeleton = render(<ChartSkeleton />).container.firstElementChild;
  const chart = render(<PriceChart />).container.firstElementChild;

  expect(skeleton?.className).toBe(chart?.className);
});
