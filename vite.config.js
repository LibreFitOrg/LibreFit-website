// vite.config.js

import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // This is the entry point
        main: resolve(__dirname, 'index.html'),


        privacy: resolve(__dirname, 'privacy.html'),


        contact: resolve(__dirname, 'contact.html'),

        support: resolve(__dirname, 'support.html'),

        license: resolve(__dirname, 'license-info.html'), 


        notfound: resolve(__dirname, '404.html'), 
      },
    },
  },
});