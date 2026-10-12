import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dashboard runs entirely in the browser (no API routes, no server
  // actions), so it can also be exported as plain static files for static
  // hosting: `STATIC_EXPORT=1 npx next build` writes the site to out/.
  // Normal builds (and `next start`, which the e2e tests use) are unchanged.
  output: process.env.STATIC_EXPORT === '1' ? 'export' : undefined,
  turbopack: {
    rules: {
      // Run every CSS file through Tailwind's Turbopack loader, which expands
      // the @import "tailwindcss" and utility classes in globals.css.
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
