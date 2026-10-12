/**
 * Colours for the mobile app: the same tokens as the web app's globals.css,
 * so both apps look like one product.
 */
export const colors = {
  ink: '#020617', // screen background (slate-950)
  panel: '#0f172a', // cards (slate-900)
  raised: '#1e293b', // selected rows, active segments (slate-800)
  line: '#1e293b', // borders and dividers (slate-800)
  fg: '#e2e8f0', // main text (slate-200)
  muted: '#94a3b8', // secondary text (slate-400)
  up: '#22c55e', // price up and Buy
  down: '#ef4444', // price down and Sell
  accent: '#fbbf24', // logo, selected row, "Simulated" badge (amber-400)
} as const;

/** Text colour for a signed number: green above zero, red below, muted at zero. */
export function signColor(value: number): string {
  if (value > 0) return colors.up;
  if (value < 0) return colors.down;
  return colors.muted;
}
