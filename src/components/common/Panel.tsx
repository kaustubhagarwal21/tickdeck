import { useId, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Shown at the right end of the title bar, for example a badge or the selected symbol. */
  aside?: ReactNode;
  /** Classes for the content area under the title bar, for example "overflow-y-auto". */
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The card that every dashboard panel sits in.
 *
 * It renders a <section> labelled by its own heading, which makes each panel a
 * named landmark: screen-reader users can jump straight to "Order book".
 */
export function Panel({ title, aside, bodyClassName = '', className = '', children }: PanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-panel ${className}`}
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <h2
          id={headingId}
          className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase font-stretch-semi-condensed"
        >
          {title}
        </h2>
        {aside}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
