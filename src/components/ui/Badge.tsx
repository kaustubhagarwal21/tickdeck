import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'up' | 'down' | 'accent' | 'info';
export type BadgeVariant = 'soft' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The colour: up / down for market direction, accent for notices, info for neutral status. */
  tone?: BadgeTone;
  /** soft: tinted background. outline: border only, for a quieter label. */
  variant?: BadgeVariant;
}

const SOFT: Record<BadgeTone, string> = {
  neutral: 'bg-raised text-fg',
  up: 'bg-up/15 text-up',
  down: 'bg-down/15 text-down',
  accent: 'bg-accent/15 text-accent',
  info: 'bg-focus/15 text-focus',
};

const OUTLINE: Record<BadgeTone, string> = {
  neutral: 'border border-muted/50 text-muted',
  up: 'border border-up/50 text-up',
  down: 'border border-down/50 text-down',
  accent: 'border border-accent/50 text-accent',
  info: 'border border-focus/50 text-focus',
};

/**
 * A short status label, such as "Filled", "Open" or "Simulated".
 *
 * The capitals come from CSS (uppercase), not from the text itself, so screen
 * readers read "Filled" as a word instead of spelling out F-I-L-L-E-D. The
 * text always says what the colour means, so colour is never the only signal.
 */
export function Badge({ tone = 'neutral', variant = 'soft', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-3xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase',
        variant === 'soft' ? SOFT[tone] : OUTLINE[tone],
        className,
      )}
      {...rest}
    />
  );
}
