/**
 * A grey placeholder bar shown while data loads. It is decorative, so it is
 * hidden from screen readers; the panel says "Loading" in text instead.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-sm bg-muted/20 motion-reduce:animate-none ${className}`}
    />
  );
}
