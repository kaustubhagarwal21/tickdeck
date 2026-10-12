/**
 * Marks prices that are generated in the browser rather than streamed from an
 * exchange, so nobody mistakes the simulated NSE feed for real quotes.
 */
export function SimulatedBadge() {
  return (
    <span className="rounded-sm border border-accent/50 px-1.5 py-px text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
      Simulated
    </span>
  );
}
