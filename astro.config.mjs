import { defineConfig } from 'astro/config';
import { isStoreOpen, storePages } from './scripts/store-pages.mjs';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
  integrations: [
    storePages({
      open: isStoreOpen(process.env),
      folder: new URL('./src/store-pages/', import.meta.url),
      entryBase: './src/store-pages',
    }),
  ],
});
