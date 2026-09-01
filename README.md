# LibreFit Website

The official website for LibreFit, built with [Astro](https://astro.build) and Cloudflare Pages to handle contact forms, donations and supporter code rewards.

Pages live in `src/pages` as `.astro` components sharing the `BaseLayout` (header/footer/SEO).
Styling is **Tailwind CSS v4** (CSS-first config) with the [Material Design 3](https://m3.material.io)
token system: `src/styles/global.css` is the single entry that imports Tailwind, maps every MD3
color/elevation/shape/motion token to Tailwind's `@theme` namespaces, and defines the MD3
typography utilities plus a small set of MD3 component classes (`.md-*`) in `@layer components`.

The static build (`npm run build`) emits flat `.html` files (`privacy.html`, `contact-result/contact-success.html`,
`404.html`, ...) so every legacy URL keeps working with the [functions](./functions).

### Styling architecture

- `src/styles/global.css` — Tailwind v4 entry (CSS-first, no `tailwind.config.js`): `@theme`
  tokens (MD3 colors → `text-primary`, `bg-surface-container`, etc.; MD3 elevation →
  `shadow-elev-*`; MD3 motion easings → `ease-*`; site breakpoints 600/900 px → `sm:`/`lg:`),
  `@utility` definitions (`container`, `md-typescale-*`, `reveal`, `animate-hero`, ...) and the
  MD3 component classes (`.md-assist-chip`, `.md-filled-button`, `.md-text-field`, `content-card`
  ecosystem, ...) shared by every page.
- `templates/app.css` — separate Tailwind entry for the [worker templates](./templates):
  it imports `src/styles/global.css` and scans `templates/*.html`, so the Cloudflare Pages worker
  pages (`/status.html`, `/error.html`) receive the same design system through the generated
  `public/styles.css`. `public/styles.css` is a **build artifact** — regenerate it with
  `npm run build:templates-css` (runs automatically as part of `npm run build`).
- Pages use Tailwind utilities directly in markup; shared primitives (MD3 buttons/chips,
  typography scale, `reveal`/`animate-hero` animations) remain as component classes because they
  are reused across pages and rely on state layers/ripples that don't map 1:1 to utilities.

## ⚡ Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Local Development**
    *   **Frontend only:**
        ```bash
        npm run dev
        ```
    *   **Full Site (Frontend + Backend Functions):**
        *Required to test `contact.js` form handling locally and the other [functions](./functions).
        Build the site first (`npm run build`), then serve `dist/` with the functions.*
        ```bash
        npm run build && npx wrangler pages dev dist
        ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

## 🎨 Styling

Tailwind CSS v4 via the Vite plugin (`@tailwindcss/vite`), CSS-first configuration. All Material
Design 3 tokens (dark color scheme, elevation, shape, motion) live in `src/styles/global.css` and
are exposed both as CSS variables (single source of truth) and as Tailwind theme tokens, e.g.
`text-primary`, `bg-surface-container-high`, `border-outline-variant`, `shadow-elev-2`,
`ease-emphasized`, `rounded-2xl` (28px), `lg:` (900px).

Worker-rendered pages (donation status / server error) are plain HTML templates under `templates/`
served by Cloudflare Pages Functions; they share the same design tokens via a second Tailwind
entry (`templates/app.css`) compiled to `public/styles.css` by `@tailwindcss/cli` during
`npm run build`.

## ⚖ License

LibreFit is licensed under the [GNU General Public License v3.0 (GPL-3)](COPYING) and it is subject
to these [additional terms](ADDITIONAL_TERMS.md).

In short, this means you are free to use, modify, and distribute the code, but you must:

- **Share your changes**: If you distribute a modified version, you must also license it under the
  GPLv3.
- **Give credit:** Keep the original copyright notice and attribute the original work to LibreFit.
- **Mark your changes:** Clearly indicate that your version is a modification of the original.
- **Do not use the brand:** You cannot use the name "LibreFit" or its logo to promote your modified
  version.

### Branding and Assets

The "LibreFit" name and logos are trademarks. **All Rights Reserved**.

Their use is governed by the [Trademark Policy](TRADEMARK_POLICY.md) which applies to relevant files located `public/assets`.