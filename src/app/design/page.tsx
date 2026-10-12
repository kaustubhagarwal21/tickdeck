import type { Metadata } from 'next';
import Link from 'next/link';
import { ComponentGallery } from './ComponentGallery';
import { TokenSwatches } from './TokenSwatches';

export const metadata: Metadata = {
  title: 'Design system · TickDeck',
  description: 'TickDeck’s design tokens and UI components in every state, with accessibility notes.',
};

const CONTENTS = [
  { id: 'colours', label: 'Colour' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'radii', label: 'Radii' },
  { id: 'type', label: 'Type' },
  { id: 'button', label: 'Button' },
  { id: 'badge', label: 'Badge' },
  { id: 'card', label: 'Card' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'number-field', label: 'NumberField' },
  { id: 'price-cell', label: 'PriceCell' },
  { id: 'skeleton', label: 'Skeleton' },
];

/**
 * /design: the living style guide.
 *
 * This file is a Server Component, so it can export metadata. The sections
 * are Client Components because they have interactive examples and read the
 * token values from the browser's CSS. The page has no data and no server
 * code, so the static export writes it out as plain HTML like the terminal.
 */
export default function DesignPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="w-fit text-xs text-muted hover:text-fg">
          ← Back to the terminal
        </Link>
        <h1 className="text-2xl font-semibold">TickDeck design system</h1>
        <p className="max-w-prose text-sm text-muted">
          The tokens and components the trading terminal is built from, in every state. Token values are read
          live from the CSS variables in globals.css, so this page always matches the app. The components live
          in src/components/ui.
        </p>
        <nav aria-label="Sections">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {CONTENTS.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-focus hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex flex-col gap-14">
        <TokenSwatches />
        <ComponentGallery />
      </main>
    </div>
  );
}
