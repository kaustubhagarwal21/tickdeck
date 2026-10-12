'use client';

/**
 * Collects the page's Core Web Vitals from real visits (field data).
 *
 * useReportWebVitals is Next.js's wrapper around Google's web-vitals library.
 * It calls reportVital() with each metric once the browser has measured it:
 * - FCP and TTFB soon after the page loads;
 * - LCP when the visitor first clicks or presses a key (or leaves the page),
 *   because until then a larger element could still paint;
 * - CLS and INP when the page is hidden, because they build up over the visit.
 *
 * The latest value of each metric is kept on window.__vitals, where the
 * Playwright tests (e2e/vitals.spec.ts) and DevTools can read it.
 *
 * Renders nothing. Mount it once, in the root layout.
 */
import { useReportWebVitals } from 'next/web-vitals';

/** The metrics that useReportWebVitals reports. */
export type VitalName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';

/**
 * The fields we keep from each report. The library's Metric object has more
 * (delta, id, entries, navigationType). Next.js does not ship type
 * declarations for its bundled copy of web-vitals, so its Metric type is
 * `any`; this interface gives our code a real type instead.
 */
export interface VitalMetric {
  name: VitalName;
  /** Milliseconds for the timings; a unitless score for CLS. */
  value: number;
  /** Compared with Google's published thresholds for this metric. */
  rating: 'good' | 'needs-improvement' | 'poor';
}

/** The latest value of each metric reported so far. */
export type Vitals = Partial<Record<VitalName, VitalMetric>>;

declare global {
  interface Window {
    /** Core Web Vitals of this page load, written by reportVital(). */
    __vitals?: Vitals;
  }
}

/**
 * Stores one metric on window.__vitals. A metric can be reported more than
 * once (for example LCP after a back/forward-cache restore, or twice in
 * development, where React runs effects twice), so the newest report wins.
 */
export function reportVital({ name, value, rating }: VitalMetric): void {
  window.__vitals = { ...window.__vitals, [name]: { name, value, rating } };
}

export function WebVitals() {
  // The hook re-registers its observers whenever the callback changes, so it
  // gets reportVital, a module-level function that is the same on every render.
  useReportWebVitals(reportVital);
  return null;
}
