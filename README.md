# LibreFit Website

The official website for LibreFit, built with Vite and Cloudflare Pages to handle contact forms, donations and supporter code rewards.

## Quick Start ⚡

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Local Development**
    *   **Frontend only:**
        ```bash
        npx vite
        ```
    *   **Full Site (Frontend + Backend Functions):**
        *Required to test `contact.js` form handling locally and the other [functions](./functions).*
        ```bash
        npx wrangler pages dev .
        ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

## License ⚖

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

The "LibreFit" name and logos are trademarks. Their use is governed by
the [Trademark Policy](TRADEMARK_POLICY.md).

The source design files for the brand assets are located in the `public/assets` directory and are licensed
under [CC BY-NC-ND 4.0](http://creativecommons.org/licenses/by-nc-nd/4.0/).

### Credits

This site uses the Roboto font and Material Symbols icons, both made available by Google and licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0). 