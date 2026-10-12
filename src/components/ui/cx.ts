/**
 * Joins class names and skips the empty ones, so a conditional class reads
 * as one expression: cx('base', isActive && 'bg-raised', className).
 *
 * It does not resolve clashes between Tailwind utilities (that would need a
 * library such as tailwind-merge). The components avoid clashes instead: each
 * one picks exactly one class per property from its own lookup tables.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
