import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// next/font downloads the fonts at build time and serves them from this app:
// no request to Google from the browser, and no layout shift while they load.
//
// IBM Plex Sans is a variable font with a width axis, so one file covers the
// body text and the condensed headings (font-stretch-condensed in Tailwind).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-plex-sans',
  display: 'swap',
});

// Every price, quantity and time is set in the monospaced Plex Mono, so digits
// line up in columns and numbers do not jiggle as they change.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TickDeck · Real-time trading dashboard',
  description:
    'Real-time trading dashboard: live watchlist, order book, candlestick chart and paper trading on Binance or simulated NSE-style data.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
