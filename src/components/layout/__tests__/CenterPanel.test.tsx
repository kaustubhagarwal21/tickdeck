import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CenterPanel } from '../CenterPanel';

// lightweight-charts is the stub in __mocks__/lightweight-charts.ts, so the
// chart can mount in jsdom.

it('shows the price chart first, in the selected Chart tab', async () => {
  render(<CenterPanel />);

  expect(screen.getByRole('tablist', { name: 'Chart or option chain' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('region', { name: 'Price chart' })).toBeInTheDocument();
  // Let the lazily loaded chart finish loading inside the test.
  expect(await screen.findByRole('img', { name: /chart/i })).toBeInTheDocument();
});

it('loads the option chain when its tab is chosen, and only then', async () => {
  const user = userEvent.setup();
  render(<CenterPanel />);
  expect(screen.queryByRole('region', { name: 'Option chain' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Option chain' }));

  expect(screen.getByRole('tab', { name: 'Option chain' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByRole('region', { name: 'Option chain' })).toBeInTheDocument();
  // Only the selected tab renders its panel, so the chart is gone.
  expect(screen.queryByRole('region', { name: 'Price chart' })).not.toBeInTheDocument();
});
