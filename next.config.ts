import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
