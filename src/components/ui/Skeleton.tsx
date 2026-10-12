import { cx } from './cx';

export type SkeletonShape = 'line' | 'block' | 'circle';

export interface SkeletonProps {
  /** line: a bar of text. block: a chart or card area. circle: an avatar or icon. */
  shape?: SkeletonShape;
  /** The size, as Tailwind classes, e.g. "h-3 w-16". Without it the shape's default size is used. */
  className?: string;
}

const CORNERS: Record<SkeletonShape, string> = {
  line: 'rounded-sm',
  block: 'rounded-md',
  circle: 'rounded-full',
};

const DEFAULT_SIZES: Record<SkeletonShape, string> = {
  line: 'h-3 w-16',
  block: 'h-16 w-full',
  circle: 'size-6',
};

/**
 * A grey placeholder shown where data will appear, so the layout does not
 * jump when it arrives.
 *
 * It is decorative and hidden from screen readers (aria-hidden); the panel
 * around it should say "Loading" in text, or set aria-busy, instead. The pulse
 * stops for people who ask for reduced motion.
 */
export function Skeleton({ shape = 'line', className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block animate-pulse bg-muted/20 motion-reduce:animate-none',
        CORNERS[shape],
        // The caller's size replaces the default instead of competing with it.
        className ?? DEFAULT_SIZES[shape],
      )}
    />
  );
}
