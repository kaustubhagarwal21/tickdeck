/**
 * Measures the first-load JavaScript of the dashboard page.
 *
 * Next.js 16 no longer prints a "First Load JS" column in `next build`, so
 * this script works it out from the build output instead: it reads the
 * prerendered page (.next/server/app/index.html), finds every script and
 * stylesheet the page loads from /_next/static/, and prints each file's size
 * as stored on disk (raw) and gzip-compressed (roughly what goes over the
 * network). The Web Worker script is not counted: it loads after the page
 * starts the simulated feed.
 *
 * Usage: npm run build, then npm run size
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const html = readFileSync(path.join(root, '.next/server/app/index.html'), 'utf8');

/** Unique /_next/static/... URLs with the given extension, in the order the page lists them. */
function assets(extension) {
  const pattern = new RegExp(`/_next/static/[^"'\\s]+\\.${extension}`, 'g');
  return [...new Set(html.match(pattern) ?? [])];
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

function report(title, urls) {
  let raw = 0;
  let gzip = 0;
  console.log(title);
  for (const url of urls) {
    const file = readFileSync(path.join(root, '.next', url.replace('/_next/', '')));
    const zipped = gzipSync(file, { level: 9 }).length;
    raw += file.length;
    gzip += zipped;
    console.log(`  ${path.basename(url).padEnd(28)} ${kb(file.length).padStart(10)} raw ${kb(zipped).padStart(10)} gzip`);
  }
  console.log(`  ${'total'.padEnd(28)} ${kb(raw).padStart(10)} raw ${kb(gzip).padStart(10)} gzip (${urls.length} files)\n`);
}

report('First-load JavaScript for /', assets('js'));
report('CSS for /', assets('css'));
