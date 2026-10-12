import { useId } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  /** Name of the group for screen readers, e.g. "Order type". Not shown on screen. */
  legend: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Classes for the chosen segment, e.g. green for Buy. Defaults to a neutral raised look. */
  checkedClassName?: (value: T) => string;
}

/**
 * A row of buttons where exactly one is on, like the Buy / Sell switch.
 *
 * It is built from native radio inputs (visually hidden) with styled labels,
 * which brings the right semantics and keyboard support for free: Tab moves
 * into the group and the arrow keys change the choice. Generic over T, so the
 * caller gets back its own type ('BUY' | 'SELL'), not a plain string.
 */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  checkedClassName,
}: SegmentedProps<T>) {
  // Radios with the same `name` form one group; useId keeps two tickets apart.
  const name = useId();

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-ink p-0.5">
        {options.map((option) => {
          const checked = option.value === value;
          const look = checked
            ? (checkedClassName?.(option.value) ?? 'bg-raised text-fg')
            : 'text-muted hover:text-fg';
          return (
            <label
              key={option.value}
              className={`flex h-7 cursor-pointer items-center justify-center rounded text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus ${look}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
