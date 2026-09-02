import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://librefit.org',
  // Auto-generate sitemap-index.xml on every build from the actual pages.
  // Exclude noindex pages (transactional form results) — sitemaps should
  // only list indexable URLs.
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/contact-result/'),
    }),
  ],
  // Fully static output
  output: 'static',
  // Astro v7 changed the default compressHTML from `true` to `'jsx'`
  // (which strips whitespace between inline elements). Keep the v6
  // behavior so existing page markup renders identically.
  // See: https://docs.astro.build/en/guides/upgrade-to/v7/
  compressHTML: true,
  build: {
    // Preserve the exact same URL/file structure as the previous
    // pure-HTML site (e.g. /privacy.html, /contact-result/contact-success.html,
    // /404.html) so no external links or Cloudflare Pages behaviors break.
    format: 'file',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});