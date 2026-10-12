import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from '../NumberField';

test('is a labelled text box that opens the decimal keypad', () => {
  render(<NumberField label="Limit price" defaultValue="3100.50" />);

  const input = screen.getByRole('textbox', { name: 'Limit price' });
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('inputmode', 'decimal');
  expect(input).toHaveValue('3100.50');
});

test('is not marked invalid and has no description without an error', () => {
  render(<NumberField label="Quantity" />);

  const input = screen.getByRole('textbox', { name: 'Quantity' });
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(input).not.toHaveAttribute('aria-describedby');
});

test('an error marks the field invalid and is read as its description', () => {
  render(<NumberField label="Quantity" error="Enter a quantity above zero." />);

  const input = screen.getByRole('textbox', { name: 'Quantity' });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Enter a quantity above zero.');

  // aria-describedby points at the element that shows the message.
  const message = screen.getByText('Enter a quantity above zero.');
  expect(input.getAttribute('aria-describedby')).toContain(message.id);
});

test('reads the hint first, then the error, and keeps a description the caller passed', () => {
  render(
    <>
      <p id="ticket-help">Prices are in rupees.</p>
      <NumberField
        label="Limit price"
        hint="Must be a multiple of 0.05."
        error="Price is below the circuit limit."
        aria-describedby="ticket-help"
      />
    </>,
  );

  expect(screen.getByRole('textbox', { name: 'Limit price' })).toHaveAccessibleDescription(
    'Prices are in rupees. Must be a multiple of 0.05. Price is below the circuit limit.',
  );
});

test('clearing the error clears aria-invalid and the description', () => {
  const { rerender } = render(<NumberField label="Quantity" error="Enter a quantity above zero." />);
  rerender(<NumberField label="Quantity" />);

  const input = screen.getByRole('textbox', { name: 'Quantity' });
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(input).not.toHaveAccessibleDescription();
  expect(screen.queryByText('Enter a quantity above zero.')).not.toBeInTheDocument();
});

test('passes typing to onChange and forwards its ref to the <input>', async () => {
  const user = userEvent.setup();
  const onChange = jest.fn();
  const ref = createRef<HTMLInputElement>();
  render(<NumberField ref={ref} label="Quantity" onChange={(event) => onChange(event.target.value)} />);

  await user.type(screen.getByRole('textbox', { name: 'Quantity' }), '12');

  expect(onChange).toHaveBeenLastCalledWith('12');
  expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Quantity' }));
});
