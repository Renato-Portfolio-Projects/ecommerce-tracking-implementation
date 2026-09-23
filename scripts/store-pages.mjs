// The switch that keeps the store closed until it is ready. The store's own pages live in
// src/store-pages, and this module adds them to the site only when PUBLIC_STORE_OPEN is "true".
// Production leaves the variable unset, so it builds the placeholder page and nothing else. Preview
// builds set it, so every pull request has a private, full copy of the store to look at.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Only the exact word "true" opens the store, so a stray "1" or "TRUE" cannot open it by accident. */
export function isStoreOpen(env) {
  return env.PUBLIC_STORE_OPEN === 'true';
}

/**
 * The address and the file of every page in a folder, found from the files' names: about.astro is
 * /about, policies/shipping.astro is /policies/shipping, and products/[slug].astro is
 * /products/[slug]. Files and folders that start with an underscore are left out.
 */
export function storeRoutes(folder, entryBase) {
  const root = fileURLToPath(folder);
  const routes = [];

  const walk = (subfolder) => {
    for (const name of readdirSync(join(root, subfolder)).sort()) {
      if (name.startsWith('_') || name.startsWith('.')) continue;
      const relative = subfolder === '' ? name : `${subfolder}/${name}`;
      if (statSync(join(root, relative)).isDirectory()) {
        walk(relative);
      } else if (name.endsWith('.astro')) {
        const address = `/${relative.slice(0, -'.astro'.length)}`.replace(/\/index$/, '');
        routes.push({ pattern: address === '' ? '/' : address, entrypoint: `${entryBase}/${relative}` });
      }
    }
  };

  walk('');
  return routes;
}

/** An Astro integration that adds the store's pages when the store is open, and does nothing when it is closed. */
export function storePages({ open, folder, entryBase }) {
  return {
    name: 'store-pages',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!open) return;
        for (const route of storeRoutes(folder, entryBase)) injectRoute(route);
      },
    },
  };
}
