'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  value: T;
  /** What the tab shows, e.g. "Orders" plus a count. */
  label: ReactNode;
}

export interface TabsProps<T extends string> {
  /** Names the tab row for screen readers, e.g. "Positions and orders". Not shown on screen. */
  label: string;
  items: readonly TabItem<T>[];
  /** The selected tab, when the parent keeps the state (controlled). */
  value?: T;
  /** The tab selected at first, when Tabs keeps the state itself. Defaults to the first item. */
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /**
   * Renders the content of the selected tab. Only the selected panel renders
   * its content, so a hidden tab's rows never re-render on live prices.
   */
  children: (value: T) => ReactNode;
  className?: string;
  /** Classes for each panel, e.g. "overflow-auto". */
  panelClassName?: string;
}

/**
 * Tabs that follow the WAI-ARIA tabs pattern (automatic activation):
 *
 * - the tab row is one Tab stop: only the selected tab has tabIndex 0;
 * - ArrowLeft / ArrowRight move to the previous / next tab and wrap around,
 *   Home / End jump to the first / last; focus and selection move together;
 * - each tab points at its panel (aria-controls) and each panel is named by
 *   its tab (aria-labelledby).
 *
 * Generic over T, so onValueChange hands back the caller's own union type
 * ('positions' | 'orders'), not a plain string.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  panelClassName,
}: TabsProps<T>) {
  const [ownValue, setOwnValue] = useState<T | undefined>(defaultValue ?? items[0]?.value);
  // Controlled when the parent passes `value`; otherwise Tabs keeps its own.
  const selected = value ?? ownValue;

  // The tab buttons, by index, so the arrow keys can move focus to them.
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Ids use the index, not the value, because a value may contain spaces.
  const idPrefix = useId();
  const tabId = (index: number) => `${idPrefix}-tab-${index}`;
  const panelId = (index: number) => `${idPrefix}-panel-${index}`;

  function select(next: T) {
    if (value === undefined) setOwnValue(next);
    onValueChange?.(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((item) => item.value === selected);
    const last = items.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current >= last ? 0 : current + 1;
        break;
      case 'ArrowLeft':
        next = current <= 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return; // Every other key (Tab, Enter, letters) keeps its normal behaviour.
    }
    event.preventDefault(); // Stops Home / End from also scrolling the page.
    select(items[next].value);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="flex h-9 shrink-0 items-stretch gap-5 border-b border-line px-3"
      >
        {items.map((item, index) => {
          const isSelected = item.value === selected;
          return (
            <button
              key={item.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={tabId(index)}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId(index)}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(item.value)}
              className="flex items-center gap-1.5 text-2xs font-semibold tracking-[0.14em] text-muted uppercase font-stretch-semi-condensed hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-selected:text-fg aria-selected:shadow-[inset_0_-2px_0_var(--color-accent)]"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item, index) => {
        const isSelected = item.value === selected;
        return (
          // tabIndex 0 lets keyboard users reach a panel that has nothing
          // focusable inside it, as the WAI-ARIA pattern recommends.
          <div
            key={item.value}
            id={panelId(index)}
            role="tabpanel"
            aria-labelledby={tabId(index)}
            hidden={!isSelected}
            tabIndex={0}
            className={cx('min-h-0 flex-1', panelClassName)}
          >
            {isSelected && children(item.value)}
          </div>
        );
      })}
    </div>
  );
}
