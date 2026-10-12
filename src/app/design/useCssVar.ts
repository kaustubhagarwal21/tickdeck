import { useSyncExternalStore } from 'react';

// Tokens do not change while the page is open, so there is nothing to listen to.
// Defined once, outside the hook, so React does not re-subscribe on every render.
const subscribe = () => () => {};

/**
 * The value of a CSS custom property, e.g. useCssVar('--color-up') → "#22c55e".
 *
 * The value lives in the browser's computed styles, outside React, so it is
 * read with useSyncExternalStore rather than an effect that sets state. The
 * static build has no browser to ask, so the server snapshot is '' and the
 * real value appears right after hydration. (jsdom in tests also returns ''.)
 */
export function useCssVar(name: string): string {
  return useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => '',
  );
}
