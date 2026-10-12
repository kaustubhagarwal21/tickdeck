/**
 * The design tokens the style guide shows. The values are not copied here:
 * the page reads them from the CSS variables at run time (see useCssVar), so
 * the guide can never drift from globals.css.
 *
 * Each entry also names a Tailwind utility that uses the token. Tailwind only
 * writes a theme variable into the CSS when something uses it, and it finds
 * class names by scanning the source, so they are written out in full here.
 */

export interface ColorToken {
  name: string;
  /** Utility that paints the swatch. */
  swatch: string;
  use: string;
}

export const COLOR_TOKENS: readonly ColorToken[] = [
  { name: '--color-ink', swatch: 'bg-ink', use: 'Page background' },
  { name: '--color-panel', swatch: 'bg-panel', use: 'Panel cards' },
  { name: '--color-raised', swatch: 'bg-raised', use: 'Hovered and selected rows, active tabs' },
  { name: '--color-line', swatch: 'bg-line', use: 'Borders and dividers' },
  { name: '--color-fg', swatch: 'bg-fg', use: 'Main text' },
  { name: '--color-muted', swatch: 'bg-muted', use: 'Secondary text and labels' },
  { name: '--color-up', swatch: 'bg-up', use: 'Price up, Buy' },
  { name: '--color-down', swatch: 'bg-down', use: 'Price down, Sell, errors' },
  { name: '--color-accent', swatch: 'bg-accent', use: 'Logo, primary action, selected row, notices' },
  { name: '--color-focus', swatch: 'bg-focus', use: 'Keyboard focus ring' },
];

export interface SpacingStep {
  /** The number in the utility name: p-4 is 4 steps of --spacing. */
  step: number;
  /** A width utility of that size, for the bar. */
  bar: string;
}

export const SPACING_STEPS: readonly SpacingStep[] = [
  { step: 1, bar: 'w-1' },
  { step: 1.5, bar: 'w-1.5' },
  { step: 2, bar: 'w-2' },
  { step: 3, bar: 'w-3' },
  { step: 4, bar: 'w-4' },
  { step: 6, bar: 'w-6' },
  { step: 8, bar: 'w-8' },
  { step: 12, bar: 'w-12' },
  { step: 16, bar: 'w-16' },
];

export interface RadiusToken {
  name: string;
  /** The rounded-* utility that uses it. */
  utility: string;
}

export const RADIUS_TOKENS: readonly RadiusToken[] = [
  { name: '--radius-xs', utility: 'rounded-xs' },
  { name: '--radius-sm', utility: 'rounded-sm' },
  { name: '--radius-md', utility: 'rounded-md' },
  { name: '--radius-lg', utility: 'rounded-lg' },
  { name: '--radius-xl', utility: 'rounded-xl' },
];

export interface TypeToken {
  name: string;
  /** The text-* utility that uses it. */
  utility: string;
  use: string;
}

export const TYPE_TOKENS: readonly TypeToken[] = [
  { name: '--text-3xs', utility: 'text-3xs', use: 'Badges and counters' },
  { name: '--text-2xs', utility: 'text-2xs', use: 'Panel titles, tab labels, field hints' },
  { name: '--text-xs', utility: 'text-xs', use: 'Table rows, form labels' },
  { name: '--text-sm', utility: 'text-sm', use: 'Prices, buttons, body text' },
  { name: '--text-base', utility: 'text-base', use: 'Large buttons' },
  { name: '--text-lg', utility: 'text-lg', use: 'Section headings' },
  { name: '--text-2xl', utility: 'text-2xl', use: 'Page title' },
];
