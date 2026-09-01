# LibreFit Website

The official website for LibreFit, built with [Astro](https://astro.build) and Cloudflare Pages to handle contact forms, donations and supporter code rewards.

Pages live in `src/pages` as `.astro` components sharing the `BaseLayout` (header/footer/SEO). The
Material Design 3 token system and global styles are in `src/styles/global.css`. The static build
(`npm run build`) emits flat `.html` files (`privacy.html`, `contact-result/contact-success.html`,
`404.html`, ...) so every legacy URL keeps working with the [functions](./functions).

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