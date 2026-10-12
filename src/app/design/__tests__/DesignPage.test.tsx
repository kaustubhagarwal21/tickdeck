import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesignPage from '../page';

// A smoke test for the style guide: it renders without a browser stylesheet
// (as during the static build) and its interactive examples work.

test('renders every section listed in its table of contents', () => {
  render(<DesignPage />);

  expect(screen.getByRole('heading', { level: 1, name: 'TickDeck design system' })).toBeInTheDocument();

  const contents = screen.getByRole('navigation', { name: 'Sections' });
  const links = within(contents).getAllByRole('link');
  expect(links).toHaveLength(11);
  for (const link of links) {
    const id = link.getAttribute('href')!.slice(1);
    // Each link jumps to a section named by a heading with the same text.
    expect(screen.getByRole('region', { name: link.textContent! })).toHaveAttribute('id', id);
  }
});

test('lists every colour token, with a placeholder until the stylesheet is read', () => {
  render(<DesignPage />);

  // The first list in the section is the swatches; the second is the accessibility notes.
  const [swatches] = within(screen.getByRole('region', { name: 'Colour' })).getAllByRole('list');
  expect(within(swatches).getAllByRole('listitem')).toHaveLength(10);
  expect(within(swatches).getByText('--color-up')).toBeInTheDocument();
  // jsdom has no stylesheet, so each live value shows the placeholder.
  expect(within(swatches).getAllByText('…')).toHaveLength(10);
});

test('the tabs example switches panels with the arrow keys', async () => {
  const user = userEvent.setup();
  render(<DesignPage />);

  await user.click(screen.getByRole('tab', { name: /positions/i }));
  await user.keyboard('{ArrowRight}');

  expect(screen.getByRole('tab', { name: /orders/i })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Buy 10 TCS at limit 3,000.00 (open)');
});

test('the live quantity example shows an error and clears it', async () => {
  const user = userEvent.setup();
  render(<DesignPage />);

  const input = screen.getByRole('textbox', { name: 'Quantity (live example)' });
  await user.type(input, '2.5');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Whole shares only. Enter a whole number of shares above zero.');

  await user.clear(input);
  await user.type(input, '25');
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(input).toHaveAccessibleDescription('Whole shares only.');
});
