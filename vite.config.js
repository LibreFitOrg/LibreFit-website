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

        contactSuccess: resolve(__dirname, 'contact-result/contact-success.html'),

        contactFail: resolve(__dirname, 'contact-result/contact-fail.html'),

        contactInvalid: resolve(__dirname, 'contact-result/contact-invalid-data.html'),

        donate: resolve(__dirname, 'donate.html'),

        status: resolve(__dirname, 'status.html'),

        license: resolve(__dirname, 'license-info.html'), 

        notfound: resolve(__dirname, '404.html'), 
      },
    },
  },
});