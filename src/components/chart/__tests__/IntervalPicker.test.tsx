import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Interval } from '@tickdeck/core';
import { IntervalPicker } from '../IntervalPicker';

/** Keeps the selected interval in state, the way PriceChart does. */
function Picker({ initial = '1s', onChange }: { initial?: Interval; onChange?: (interval: Interval) => void }) {
  const [value, setValue] = useState<Interval>(initial);
  return (
    <IntervalPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('IntervalPicker', () => {
  it('is a radio group with the current interval checked', () => {
    render(<IntervalPicker value="5s" onChange={() => {}} />);

    expect(screen.getByRole('radiogroup', { name: 'Candle interval' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['1s', '5s', '1m']);
    expect(radio('5s')).toBeChecked();
    expect(radio('1s')).not.toBeChecked();
    expect(radio('1m')).not.toBeChecked();
  });

  it('selects an interval on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IntervalPicker value="1s" onChange={onChange} />);

    await user.click(radio('1m'));

    expect(onChange).toHaveBeenCalledWith('1m');
  });

  it('is a single Tab stop that lands on the checked option', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Picker initial="5s" />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    await user.tab();
    expect(radio('5s')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves selection and focus with the arrow keys, wrapping around at the ends', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Picker onChange={onChange} />);
    await user.tab();
    expect(radio('1s')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio('5s')).toHaveFocus();
    expect(radio('5s')).toBeChecked();

    await user.keyboard('{ArrowDown}');
    expect(radio('1m')).toHaveFocus();

    await user.keyboard('{ArrowRight}'); // past the last option: back to the first
    expect(radio('1s')).toHaveFocus();
    expect(radio('1s')).toBeChecked();

    await user.keyboard('{ArrowLeft}'); // before the first option: round to the last
    expect(radio('1m')).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(radio('5s')).toHaveFocus();

    expect(onChange.mock.calls.map(([interval]) => interval)).toEqual(['5s', '1m', '1s', '1m', '5s']);
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Picker onChange={onChange} />);
    await user.tab();

    await user.keyboard('{Home}{End}x');

    expect(onChange).not.toHaveBeenCalled();
    expect(radio('1s')).toBeChecked();
  });
});
