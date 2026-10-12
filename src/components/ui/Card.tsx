import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Shown in the title bar. It also names the card for screen readers. */
  title?: string;
  /** Shown at the right end of the title bar, e.g. a badge or a symbol. */
  aside?: ReactNode;
  /** h2 for a top-level panel; a lower level when the card sits under another heading. */
  headingLevel?: 2 | 3 | 4;
  /** Classes for the content area, e.g. "overflow-y-auto" or "p-3". */
  bodyClassName?: string;
}

/**
 * The surface every panel sits on: a bordered card with an optional title bar.
 *
 * With a title it renders a <section> labelled by its heading, so it becomes a
 * named region that screen-reader users can jump to ("Order book"). Without a
 * title it is a plain container.
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, aside, headingLevel = 2, bodyClassName, className, children, ...rest },
  ref,
) {
  const headingId = useId();
  // A tag name in a variable must start with a capital letter in JSX.
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      ref={ref}
      aria-labelledby={title ? headingId : undefined}
      className={cx('flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-panel', className)}
      {...rest}
    >
      {title && (
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <Heading
            id={headingId}
            className="text-2xs font-semibold tracking-[0.14em] text-muted uppercase font-stretch-semi-condensed"
          >
            {title}
          </Heading>
          {aside}
        </div>
      )}
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
});
