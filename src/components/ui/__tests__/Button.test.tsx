import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

test('is a plain button by default and calls onClick', async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  render(<Button onClick={onClick}>Save</Button>);

  const button = screen.getByRole('button', { name: 'Save' });
  // Not "submit", so a Button inside a form never sends the form by accident.
  expect(button).toHaveAttribute('type', 'button');
  await user.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('uses the market colours for the buy and sell variants', () => {
  render(
    <>
      <Button variant="buy">Buy TCS</Button>
      <Button variant="sell">Sell TCS</Button>
    </>,
  );

  expect(screen.getByRole('button', { name: 'Buy TCS' })).toHaveClass('bg-up');
  expect(screen.getByRole('button', { name: 'Sell TCS' })).toHaveClass('bg-down');
});

test('a disabled button cannot be clicked or reached with Tab', async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  render(
    <Button disabled onClick={onClick}>
      Buy TCS
    </Button>,
  );

  const button = screen.getByRole('button', { name: 'Buy TCS' });
  expect(button).toBeDisabled();
  await user.click(button);
  expect(onClick).not.toHaveBeenCalled();
  await user.tab();
  expect(button).not.toHaveFocus();
});

test('a loading button ignores clicks but keeps keyboard focus', async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  render(
    <Button loading loadingText="Placing order…" onClick={onClick}>
      Buy TCS
    </Button>,
  );

  const button = screen.getByRole('button', { name: 'Placing order…' });
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).toHaveAttribute('aria-disabled', 'true');
  // Not natively disabled, so focus is not lost while the action runs.
  expect(button).toBeEnabled();
  await user.tab();
  expect(button).toHaveFocus();

  await user.click(button);
  await user.keyboard('{Enter}');
  expect(onClick).not.toHaveBeenCalled();
});

test('a loading submit button does not submit its form again', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn((event: { preventDefault: () => void }) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <Button type="submit" loading>
        Buy TCS
      </Button>
    </form>,
  );

  await user.click(screen.getByRole('button', { name: 'Buy TCS' }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test('a submit button that is not loading submits its form', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn((event: { preventDefault: () => void }) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <Button type="submit">Buy TCS</Button>
    </form>,
  );

  await user.click(screen.getByRole('button', { name: 'Buy TCS' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('forwards its ref to the <button>', () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref}>Save</Button>);

  expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }));
});
