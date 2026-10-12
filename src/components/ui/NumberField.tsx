import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';

export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> {
  /** The visible label, e.g. "Quantity". It is also the input's accessible name. */
  label: string;
  /** A short help line under the box, e.g. "Whole shares only". */
  hint?: string;
  /** A validation message. When set, the field is marked invalid and the message is read with it. */
  error?: string;
  /** stacked: label above the box. inline: label on the left, as in the order ticket. */
  layout?: 'stacked' | 'inline';
  /** Classes for the wrapper around the label, the box and the messages (not the box itself). */
  className?: string;
}

/**
 * A labelled text box for a price or a quantity.
 *
 * - type="text" with inputMode="decimal": phones open the number keypad, but
 *   the value is a plain string. type="number" would change the value when the
 *   mouse wheel scrolls over it, and hides half-typed input such as "12.".
 * - The <label> is tied to the input with htmlFor / id, so clicking the label
 *   focuses the box and screen readers announce the label as its name.
 * - An error sets aria-invalid="true" and is linked with aria-describedby (so
 *   is the hint), so a screen reader reads "Quantity, invalid entry, Enter a
 *   quantity above zero". The red border is never the only signal.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, hint, error, layout = 'stacked', id, className, 'aria-describedby': describedBy, ...inputProps },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const hintId = `${autoId}-hint`;
  const errorId = `${autoId}-error`;
  const invalid = Boolean(error);

  // Keep any description the caller passed, then add the hint and the error.
  const describedByIds =
    [describedBy, hint && hintId, invalid && errorId].filter(Boolean).join(' ') || undefined;

  const inline = layout === 'inline';

  return (
    <div
      className={cx(
        inline ? 'grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1' : 'flex flex-col gap-1',
        className,
      )}
    >
      <label htmlFor={inputId} className="text-xs text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedByIds}
        className={cx(
          'h-8 w-full rounded border bg-ink px-2 text-right font-mono text-sm tabular-nums',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
          'disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60',
          invalid ? 'border-down' : 'border-line',
        )}
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className={cx('text-2xs text-muted', inline && 'col-start-2')}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={cx('text-2xs text-down', inline && 'col-start-2')}>
          {error}
        </p>
      )}
    </div>
  );
});
