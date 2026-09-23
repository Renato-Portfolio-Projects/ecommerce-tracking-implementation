import type { AstroIntegration } from 'astro';

export interface StoreRoute {
  pattern: string;
  entrypoint: string;
}

export function isStoreOpen(env: Record<string, string | undefined>): boolean;
export function storeRoutes(folder: URL, entryBase: string): StoreRoute[];
export function storePages(options: { open: boolean; folder: URL; entryBase: string }): AstroIntegration;
