import { render } from '@testing-library/react';
import { useReportWebVitals } from 'next/web-vitals';
import { reportVital, WebVitals } from '../WebVitals';

// jsdom has no PerformanceObserver, so the real hook could not measure
// anything here. Replace it with a mock and check how WebVitals uses it.
jest.mock('next/web-vitals', () => ({ useReportWebVitals: jest.fn() }));

afterEach(() => {
  delete window.__vitals;
});

it('hands reportVital to Next.js and renders nothing', () => {
  const { container } = render(<WebVitals />);

  expect(useReportWebVitals).toHaveBeenCalledWith(reportVital);
  expect(container).toBeEmptyDOMElement();
});

it('passes the same callback on every render, so the observers are registered once', () => {
  const { rerender } = render(<WebVitals />);
  rerender(<WebVitals />);

  const callbacks = jest.mocked(useReportWebVitals).mock.calls.map(([callback]) => callback);
  expect(callbacks).toHaveLength(2);
  expect(callbacks[1]).toBe(callbacks[0]);
});

it('keeps the newest value of each metric on window.__vitals', () => {
  reportVital({ name: 'FCP', value: 420, rating: 'good' });
  reportVital({ name: 'LCP', value: 1_900, rating: 'good' });
  reportVital({ name: 'LCP', value: 2_700, rating: 'needs-improvement' });

  expect(window.__vitals).toEqual({
    FCP: { name: 'FCP', value: 420, rating: 'good' },
    LCP: { name: 'LCP', value: 2_700, rating: 'needs-improvement' },
  });
});

it('keeps only name, value and rating from the library’s metric object', () => {
  // The shape web-vitals actually reports, with fields we do not store.
  const metric = {
    name: 'CLS',
    value: 0.02,
    rating: 'good',
    delta: 0.02,
    id: 'v6-1760000000000-1234',
    entries: [],
    navigationType: 'navigate',
  } as const;

  reportVital(metric);

  expect(window.__vitals).toEqual({ CLS: { name: 'CLS', value: 0.02, rating: 'good' } });
});
