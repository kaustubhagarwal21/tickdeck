'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { Interval } from '@tickdeck/core';

/** The intervals on offer, in display order. */
const INTERVALS: Interval[] = ['1s', '5s', '1m'];

interface IntervalPickerProps {
  value: Interval;
  onChange: (interval: Interval) => void;
}

/**
 * Chooses the candle interval. It looks like a row of buttons, but exactly one
 * option is always selected, so it follows the WAI-ARIA radio group pattern:
 * - role="radiogroup" on the row, and role="radio" with aria-checked on each button;
 * - roving tabindex: only the selected button is in the Tab order, so Tab moves
 *   into and out of the whole group in one step;
 * - the arrow keys select the next or previous option (wrapping around at the
 *   ends) and move focus to it, the way native radio buttons behave.
 */
export function IntervalPicker({ value, onChange }: IntervalPickerProps) {
  // The buttons, so the arrow keys can move focus between them.
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let step = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step = 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step = -1;
    if (step === 0) return;

    // Stop the arrow key from also scrolling the page.
    event.preventDefault();
    // Adding the length before % keeps the index positive when stepping left from 0.
    const next = (index + step + INTERVALS.length) % INTERVALS.length;
    buttons.current[next]?.focus();
    onChange(INTERVALS[next]);
  }

  return (
    <div role="radiogroup" aria-label="Candle interval" className="inline-flex rounded-md bg-slate-800/60 p-0.5">
      {INTERVALS.map((interval, index) => {
        const checked = interval === value;
        return (
          <button
            key={interval}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(interval)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="rounded px-2 py-0.5 text-xs font-medium text-slate-400 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-sky-400 aria-checked:bg-slate-600 aria-checked:text-white"
          >
            {interval}
          </button>
        );
      })}
    </div>
  );
}
