'use client';

import { useEffect, useState } from 'react';
import { formatPercent, formatPrice } from '@/components/common/format';
import { Badge, Button, Card, NumberField, PriceCell, Skeleton, Tabs, type BadgeTone } from '@/components/ui';
import { ExampleRow, GuideSection } from './GuideSection';

const TONES: { tone: BadgeTone; text: string }[] = [
  { tone: 'neutral', text: 'Cancelled' },
  { tone: 'up', text: 'Long' },
  { tone: 'down', text: 'Short' },
  { tone: 'accent', text: 'Simulated' },
  { tone: 'info', text: 'Open' },
];

/** Sample quotes for the PriceCell table: a rise, a fall and no change. */
const QUOTES = [
  { symbol: 'TCS', last: 3101.5, changePct: 0.42 },
  { symbol: 'INFY', last: 1499.95, changePct: -1.18 },
  { symbol: 'BTCUSDT', last: 64250.1, changePct: 0 },
];

type DemoTab = 'positions' | 'orders';

/** Every component in every state, with notes on how each one works for keyboard and screen-reader users. */
export function ComponentGallery() {
  return (
    <>
      <GuideSection
        id="button"
        title="Button"
        intro="Four variants and three sizes. Buy and Sell use the market colours; ghost is for secondary actions like Cancel."
        a11y={[
          'type defaults to "button", so a button inside a form never submits it by accident.',
          'Disabled uses the native attribute: the button is skipped by Tab and cannot be clicked.',
          'Loading keeps the button focusable (aria-disabled and aria-busy instead of disabled) and ignores clicks, so an order cannot be sent twice and keyboard users keep their place.',
          'Every button shows a 2px focus ring for keyboard users. Press Tab on this page to see it.',
        ]}
      >
        <ExampleRow label="Variants">
          <Button variant="primary">Place order</Button>
          <Button variant="buy">Buy TCS</Button>
          <Button variant="sell">Sell TCS</Button>
          <Button variant="ghost">Cancel</Button>
        </ExampleRow>
        <ExampleRow label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </ExampleRow>
        <ExampleRow label="Disabled">
          <Button variant="primary" disabled>
            Place order
          </Button>
          <Button variant="buy" disabled>
            Waiting for price
          </Button>
          <Button variant="ghost" disabled>
            Cancel
          </Button>
        </ExampleRow>
        <ExampleRow label="Loading">
          <Button variant="buy" loading loadingText="Placing order…">
            Buy TCS
          </Button>
          <Button variant="sell" loading>
            Sell TCS
          </Button>
          <LoadingDemo />
        </ExampleRow>
      </GuideSection>

      <GuideSection
        id="badge"
        title="Badge"
        intro="Short status labels. Soft for status in tables, outline for quieter notices."
        a11y={[
          'Capitals come from CSS, so screen readers read "Short" as a word instead of spelling out the letters.',
          'The word always carries the meaning; the colour only repeats it.',
        ]}
      >
        <ExampleRow label="Soft">
          {TONES.map(({ tone, text }) => (
            <Badge key={tone} tone={tone}>
              {text}
            </Badge>
          ))}
        </ExampleRow>
        <ExampleRow label="Outline">
          {TONES.map(({ tone, text }) => (
            <Badge key={tone} tone={tone} variant="outline">
              {text}
            </Badge>
          ))}
        </ExampleRow>
      </GuideSection>

      <GuideSection
        id="card"
        title="Card"
        intro="The surface every panel sits on. The title bar is optional and can hold a badge or a price on the right."
        a11y={[
          'A card with a title is a <section> labelled by its heading, so screen-reader users can jump between panels by name.',
          'headingLevel keeps the page outline in order when a card sits under another heading, as here (h3).',
        ]}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            title="Order ticket"
            headingLevel={3}
            aside={<Badge tone="accent" variant="outline">Simulated</Badge>}
            bodyClassName="p-3 text-sm"
          >
            A titled card with a badge in the title bar.
          </Card>
          <Card
            title="Quote"
            headingLevel={3}
            aside={<PriceCell value={3101.5} change={1} className="text-xs" />}
            bodyClassName="p-3 text-sm"
          >
            A live price in the title bar.
          </Card>
          <Card bodyClassName="p-3 text-sm">
            A card without a title bar.
          </Card>
        </div>
      </GuideSection>

      <GuideSection
        id="tabs"
        title="Tabs"
        intro="Switches between views in one panel, like Positions and Orders. Click a tab, or focus one and use the arrow keys."
        a11y={[
          'Follows the WAI-ARIA tabs pattern: the tab row is one Tab stop, ArrowLeft and ArrowRight move between tabs (wrapping at the ends), Home and End jump to the first and last.',
          'Selection follows focus, and each tab is linked to its panel with aria-controls and aria-labelledby.',
          'Only the selected panel renders its content, so hidden rows do not re-render on every price tick.',
        ]}
      >
        <Card className="h-48">
          <Tabs<DemoTab>
            label="Positions and orders example"
            items={[
              { value: 'positions', label: <TabLabel text="Positions" count={2} /> },
              { value: 'orders', label: <TabLabel text="Orders" count={1} /> },
            ]}
            className="h-full"
            panelClassName="overflow-auto p-3 text-sm"
          >
            {(tab) =>
              tab === 'positions' ? (
                <p>Long 10 TCS at 3,050.00 · Short 5 INFY at 1,520.00</p>
              ) : (
                <p>Buy 10 TCS at limit 3,000.00 (open)</p>
              )
            }
          </Tabs>
        </Card>
      </GuideSection>

      <GuideSection
        id="number-field"
        title="NumberField"
        intro="A labelled box for prices and quantities. Type in the live example to see an error appear and clear."
        a11y={[
          'The <label> is linked to the input, so it is the input’s name and clicking it focuses the box.',
          'inputMode="decimal" opens the number keypad on phones while keeping a plain text value.',
          'An error sets aria-invalid="true" and is linked with aria-describedby, together with the hint, so it is read with the field. The red border is never the only signal.',
        ]}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Quantity" defaultValue="10" />
          <NumberField label="Limit price" defaultValue="3100.50" hint="In rupees, a multiple of 0.05." />
          <NumberField label="Quantity" defaultValue="0" error="Enter a quantity above zero." />
          <NumberField label="Trigger price" defaultValue="3095.00" disabled hint="Only for stop-loss orders." />
          <NumberField label="Limit price" defaultValue="3100.50" layout="inline" />
          <LiveQuantityField />
        </div>
      </GuideSection>

      <GuideSection
        id="price-cell"
        title="PriceCell"
        intro="A number with its direction: green and ▲ for up, red and ▼ for down, plain for no change."
        a11y={[
          'Colour is never the only signal: an arrow shows the direction, and a hidden word ("up" or "down") tells screen readers.',
          'tabular-nums in the monospaced font keeps every digit the same width, so a column of prices lines up and does not jiggle.',
        ]}
      >
        <ExampleRow label="States">
          <PriceCell value={3101.5} change={12.4} />
          <PriceCell value={1499.95} change={-17.7} />
          <PriceCell value={250} />
        </ExampleRow>
        <table className="w-full max-w-md text-sm">
          <caption className="sr-only">Sample quotes</caption>
          <thead>
            <tr className="text-2xs text-muted uppercase">
              <th scope="col" className="py-1 text-left font-semibold">
                Symbol
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Last
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {QUOTES.map((q) => (
              <tr key={q.symbol}>
                <th scope="row" className="py-1.5 text-left font-medium">
                  {q.symbol}
                </th>
                <td className="py-1.5 text-right">
                  <PriceCell value={q.last} change={q.changePct} format={(v) => formatPrice(q.symbol, v)} />
                </td>
                <td className="py-1.5 text-right">
                  <PriceCell value={q.changePct} change={q.changePct} format={formatPercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GuideSection>

      <GuideSection
        id="skeleton"
        title="Skeleton"
        intro="Placeholders that hold the layout while data loads, so nothing jumps when it arrives."
        a11y={[
          'Skeletons are hidden from screen readers (aria-hidden); the panel says "Loading" in text and sets aria-busy instead.',
          'The pulse stops when the reader asks for reduced motion.',
        ]}
      >
        <ExampleRow label="Shapes">
          <Skeleton shape="line" />
          <Skeleton shape="circle" />
          <Skeleton shape="block" className="h-10 w-40" />
        </ExampleRow>
        <Card title="Watchlist" headingLevel={3} className="max-w-xs" aria-busy="true">
          <p className="sr-only">Loading quotes</p>
          <ul className="flex flex-col gap-3 p-3">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-16" />
              </li>
            ))}
          </ul>
        </Card>
      </GuideSection>
    </>
  );
}

/** A tab label with a count, as in the positions panel. */
function TabLabel({ text, count }: { text: string; count: number }) {
  return (
    <>
      {text}{' '}
      <span className="rounded-sm bg-raised px-1 font-mono text-3xs tracking-normal tabular-nums">{count}</span>
    </>
  );
}

/** A Buy button that shows its loading state for 1.5 seconds after a click. */
function LoadingDemo() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer); // No state update after the page is left.
  }, [loading]);

  return (
    <Button variant="buy" loading={loading} loadingText="Placing order…" onClick={() => setLoading(true)}>
      Try it: Buy 10 TCS
    </Button>
  );
}

/** A quantity box that validates as you type: whole shares above zero. */
function LiveQuantityField() {
  const [qty, setQty] = useState('');
  const error =
    qty === '' || /^[1-9]\d*$/.test(qty) ? undefined : 'Enter a whole number of shares above zero.';

  return (
    <NumberField
      label="Quantity (live example)"
      placeholder="e.g. 25"
      value={qty}
      onChange={(event) => setQty(event.target.value)}
      hint="Whole shares only."
      error={error}
    />
  );
}
