// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://librefit.org',
  // Fully static output
  output: 'static',
  build: {
    // Preserve the exact same URL/file structure as the previous
    // pure-HTML site (e.g. /privacy.html, /contact-result/contact-success.html,
    // /404.html) so no external links or Cloudflare Pages behaviors break.
    format: 'file',
  },
});