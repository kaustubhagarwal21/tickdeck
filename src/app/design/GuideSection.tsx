import type { ReactNode } from 'react';

interface GuideSectionProps {
  /** Anchor for the page's table of contents. */
  id: string;
  title: string;
  /** One or two sentences on what the section shows. */
  intro?: string;
  /** Short accessibility notes, one per item. */
  a11y?: readonly string[];
  children: ReactNode;
}

/** One section of the style guide: a heading, the examples and the accessibility notes. */
export function GuideSection({ id, title, intro, a11y, children }: GuideSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {intro && <p className="max-w-prose text-sm text-muted">{intro}</p>}
      </div>
      {children}
      {a11y && a11y.length > 0 && (
        <div className="rounded-md border border-line bg-panel/60 px-4 py-3">
          <h3 className="text-2xs font-semibold tracking-[0.14em] text-muted uppercase">Accessibility</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-fg/90">
            {a11y.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** A labelled row of examples inside a section, e.g. "Variants" or "Sizes". */
export function ExampleRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-2xs font-semibold tracking-[0.14em] text-muted uppercase">{label}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
