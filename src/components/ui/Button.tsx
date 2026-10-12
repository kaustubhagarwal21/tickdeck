import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'buy' | 'sell' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the main action. buy / sell: order actions in the market colours. ghost: secondary actions. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * An action is running (for example an order is being sent). The button
   * shows a spinner and ignores clicks, but stays focusable.
   */
  loading?: boolean;
  /** Text shown instead of the label while loading, e.g. "Placing order…". */
  loadingText?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:brightness-110',
  buy: 'bg-up text-ink hover:brightness-110',
  sell: 'bg-down text-ink hover:brightness-110',
  ghost: 'border border-line text-fg hover:bg-raised',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-base',
};

/**
 * The button for every action in the terminal.
 *
 * - type defaults to "button". The HTML default is "submit", which would make
 *   any button inside a form send the form by accident.
 * - disabled uses the native attribute: the button leaves the Tab order and
 *   cannot be clicked.
 * - loading does not use `disabled`. A disabled button drops keyboard focus,
 *   so someone who pressed Enter would lose their place. Instead it sets
 *   aria-disabled and aria-busy and cancels the click, which also stops a
 *   form from being submitted twice.
 *
 * forwardRef passes a ref through to the <button>, so a parent can focus it
 * (for example after a dialog closes).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    type = 'button',
    disabled,
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // Cancelling the click also cancels a submit button's form submission.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[filter,background-color,color] select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        SIZES[size],
        VARIANTS[variant],
        // Disabled looks the same for every variant: grey, and no hover effect.
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-raised disabled:text-muted disabled:hover:brightness-100',
        loading && 'cursor-progress opacity-80',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});
