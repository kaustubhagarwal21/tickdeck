import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, type TabItem } from '../Tabs';

type View = 'positions' | 'orders' | 'history';

const ITEMS: TabItem<View>[] = [
  { value: 'positions', label: 'Positions' },
  { value: 'orders', label: 'Orders' },
  { value: 'history', label: 'History' },
];

function renderTabs(onValueChange?: (value: View) => void) {
  return render(
    <Tabs label="Portfolio" items={ITEMS} onValueChange={onValueChange}>
      {(view) => <p>Content of {view}</p>}
    </Tabs>,
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

test('starts on the first tab and shows only its panel', () => {
  renderTabs();

  expect(screen.getByRole('tablist', { name: 'Portfolio' })).toBeInTheDocument();
  expect(tab('Positions')).toHaveAttribute('aria-selected', 'true');
  expect(tab('Orders')).toHaveAttribute('aria-selected', 'false');

  // The visible panel is named by its tab and linked from it.
  const panel = screen.getByRole('tabpanel', { name: 'Positions' });
  expect(tab('Positions')).toHaveAttribute('aria-controls', panel.id);
  expect(panel).toHaveTextContent('Content of positions');
  // Hidden panels are out of the accessibility tree and render no content.
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  expect(screen.queryByText('Content of orders')).not.toBeInTheDocument();
});

test('the tab row is a single Tab stop', async () => {
  const user = userEvent.setup();
  renderTabs();

  expect(tab('Positions')).toHaveAttribute('tabindex', '0');
  expect(tab('Orders')).toHaveAttribute('tabindex', '-1');

  await user.tab();
  expect(tab('Positions')).toHaveFocus();
  // The next Tab skips the other tabs and goes into the panel.
  await user.tab();
  expect(screen.getByRole('tabpanel')).toHaveFocus();
});

test('ArrowRight and ArrowLeft move focus and selection, wrapping at the ends', async () => {
  const user = userEvent.setup();
  renderTabs();
  await user.tab();

  await user.keyboard('{ArrowRight}');
  expect(tab('Orders')).toHaveFocus();
  expect(tab('Orders')).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: 'Orders' })).toHaveTextContent('Content of orders');

  await user.keyboard('{ArrowRight}{ArrowRight}');
  expect(tab('Positions')).toHaveFocus(); // wrapped from History back to the start

  await user.keyboard('{ArrowLeft}');
  expect(tab('History')).toHaveFocus(); // wrapped from the start to the end
  expect(tab('History')).toHaveAttribute('aria-selected', 'true');
});

test('Home and End jump to the first and last tab', async () => {
  const user = userEvent.setup();
  renderTabs();
  await user.tab();

  await user.keyboard('{End}');
  expect(tab('History')).toHaveFocus();
  expect(tab('History')).toHaveAttribute('aria-selected', 'true');

  await user.keyboard('{Home}');
  expect(tab('Positions')).toHaveFocus();
  expect(tab('Positions')).toHaveAttribute('aria-selected', 'true');
});

test('reports each change, from a click or a key', async () => {
  const user = userEvent.setup();
  const onValueChange = jest.fn();
  renderTabs(onValueChange);

  await user.click(tab('History'));
  await user.keyboard('{ArrowLeft}');

  expect(onValueChange.mock.calls).toEqual([['history'], ['orders']]);
});

test('follows the value when the parent controls it', async () => {
  const user = userEvent.setup();

  function Controlled() {
    const [view, setView] = useState<View>('orders');
    return (
      <>
        <p>Parent sees {view}</p>
        <Tabs label="Portfolio" items={ITEMS} value={view} onValueChange={setView}>
          {(v) => <p>Content of {v}</p>}
        </Tabs>
      </>
    );
  }
  render(<Controlled />);

  expect(tab('Orders')).toHaveAttribute('aria-selected', 'true');
  await user.click(tab('Orders'));
  await user.keyboard('{End}');

  expect(screen.getByText('Parent sees history')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel', { name: 'History' })).toHaveTextContent('Content of history');
});
