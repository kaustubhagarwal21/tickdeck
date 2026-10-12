'use client';

import { cx } from '@/components/ui';
import { ExampleRow, GuideSection } from './GuideSection';
import { COLOR_TOKENS, RADIUS_TOKENS, SPACING_STEPS, TYPE_TOKENS } from './tokens';
import { useCssVar } from './useCssVar';

/** The live value of a token, or an ellipsis until the browser has the stylesheet. */
function TokenValue({ name }: { name: string }) {
  const value = useCssVar(name);
  return <code className="font-mono text-2xs text-muted">{value || '…'}</code>;
}

/** Colours, spacing, radii and the type scale, each read from its CSS variable. */
export function TokenSwatches() {
  return (
    <>
      <GuideSection
        id="colours"
        title="Colour"
        intro="Ten colour tokens, defined once in globals.css under @theme. Each one is also a Tailwind utility: bg-up, text-up, border-up."
        a11y={[
          'Up and down are never shown by colour alone: prices add an arrow and a word, and buttons say Buy or Sell.',
          'Buy and Sell buttons use dark ink text on the green and red, which reads more clearly than white.',
          'The focus colour is used only for focus rings, so a focused control always looks the same.',
        ]}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <li key={token.name} className="flex flex-col gap-1.5 rounded-md border border-line bg-panel p-2">
              <span aria-hidden="true" className={cx('block h-12 rounded border border-line', token.swatch)} />
              <code className="font-mono text-xs">{token.name}</code>
              <TokenValue name={token.name} />
              <span className="text-2xs text-muted">{token.use}</span>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection
        id="spacing"
        title="Spacing"
        intro="Every gap, padding and width is a multiple of one --spacing step, so p-4 is four steps."
      >
        <SpacingScale />
      </GuideSection>

      <GuideSection id="radii" title="Radii" intro="Small corners keep dense panels crisp: rows and badges use sm, cards md.">
        <ul className="flex flex-wrap gap-4">
          {RADIUS_TOKENS.map((token) => (
            <li key={token.name} className="flex flex-col items-center gap-1.5">
              <span aria-hidden="true" className={cx('size-14 border-2 border-focus/70 bg-raised', token.utility)} />
              <code className="font-mono text-xs">{token.utility}</code>
              <TokenValue name={token.name} />
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection
        id="type"
        title="Type"
        intro="IBM Plex Sans for words and IBM Plex Mono with tabular figures for every number, so columns of prices line up."
        a11y={[
          'Sizes are in rem, so they grow with the reader’s browser font size.',
          'The 10px and 11px sizes are only for short uppercase labels and counters, never for sentences.',
        ]}
      >
        <ExampleRow label="Families">
          <p className="text-sm">IBM Plex Sans · Order ticket</p>
          <p className="font-mono text-sm tabular-nums">IBM Plex Mono · 3,101.50 1,499.95</p>
        </ExampleRow>
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-panel">
          {TYPE_TOKENS.map((token) => (
            <li
              key={token.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[7rem_5rem_minmax(0,1fr)_auto]"
            >
              <code className="font-mono text-xs">{token.utility}</code>
              <TokenValue name={token.name} />
              <span className={cx('truncate', token.utility)}>Order book 3,101.50</span>
              <span className="text-2xs text-muted">{token.use}</span>
            </li>
          ))}
        </ul>
      </GuideSection>
    </>
  );
}

/** One bar per spacing step, with its size worked out from the live --spacing value. */
function SpacingScale() {
  const base = useCssVar('--spacing'); // e.g. "0.25rem"
  const amount = Number.parseFloat(base);
  const unit = base.replace(/^[\d.]+/, '');

  return (
    <ul className="flex flex-col gap-2">
      {SPACING_STEPS.map(({ step, bar }) => (
        <li key={step} className="grid grid-cols-[3rem_5rem_minmax(0,1fr)] items-center gap-3">
          <code className="font-mono text-xs">{step}</code>
          <code className="font-mono text-2xs text-muted">
            {Number.isFinite(amount) ? `${Number((step * amount).toFixed(4))}${unit}` : '…'}
          </code>
          <span aria-hidden="true" className={cx('block h-3 rounded-sm bg-focus/60', bar)} />
        </li>
      ))}
    </ul>
  );
}
