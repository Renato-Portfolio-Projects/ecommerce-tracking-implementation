/** Helpers for reading the pages that `npm run build` and `npm run build:store` write. */
import { readFileSync, readdirSync, statSync } from 'node:fs';

/** The built site with the store closed, which is what production builds. */
export const CLOSED = new URL('../../dist/', import.meta.url);
/** The built site with the store open, which is what a preview builds. */
export const OPEN = new URL('../../dist-store/', import.meta.url);

/** Every .html file under a folder, as a path like `about/index.html`, in order. */
export function htmlFiles(folder: URL, sub = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(new URL(sub, folder))) {
    const path = `${sub}${name}`;
    if (statSync(new URL(path, folder)).isDirectory()) found.push(...htmlFiles(folder, `${path}/`));
    else if (name.endsWith('.html')) found.push(path);
  }
  return found.sort();
}

export const readPage = (folder: URL, path: string) => readFileSync(new URL(path, folder), 'utf8');

/** Turns the entities a page uses for its punctuation back into the characters, so words can be compared. */
export function decodeEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Everything a page asks another site to send, when it loads: stylesheets, scripts, images, frames, forms and
 * anything named in a style. A link that a visitor may click, like one to GitHub, is not a request.
 */
export function requestsToOtherSites(html: string): string[] {
  const other = (url: string) => /^(https?:)?\/\//.test(url);
  const found: string[] = [];
  const attribute = /<(link|script|img|iframe|source|video|audio|embed|object|form|input)\b[^>]*?\s(href|src|srcset|action|data)="([^"]*)"/gi;
  for (const match of html.matchAll(attribute)) {
    const [, tag, name, value] = match;
    if (tag.toLowerCase() === 'link' && name.toLowerCase() === 'href' && !/rel="(stylesheet|preload|modulepreload|preconnect|dns-prefetch|prefetch|icon)"/i.test(match[0])) continue;
    if (other(value)) found.push(value);
  }
  for (const match of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) if (other(match[1])) found.push(match[1]);
  for (const match of html.matchAll(/@import\s+['"]?([^'";)]+)/g)) if (other(match[1])) found.push(match[1]);
  return found;
}

/** The address of every link a visitor may click that stays on the site, without any #fragment or ?query. */
export function internalLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="(\/[^"]*)"/g)].map((match) => match[1].split(/[#?]/)[0]);
}

/** The address of every link a visitor may click that leaves the site. */
export function externalLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="(https?:\/\/[^"]*)"/g)].map((match) => match[1]);
}

/** The level of each heading, in the order they appear. */
export function headingLevels(html: string): number[] {
  return [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
}

/** The built file that answers an address like `/policies/shipping`. */
export function fileFor(address: string): string {
  return address === '/' ? 'index.html' : `${address.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

/**
 * All the script a page loads from its own site, joined, so what it contains can be searched: the scripts the page
 * names, and every file they import in the ordinary way, and those files' own imports. A file that is loaded on demand,
 * with import(), is not followed, since it is not loaded with the page.
 */
export function scriptOf(folder: URL, html: string): string {
  const seen = new Set<string>();
  const texts: string[] = [];
  const read = (url: URL) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const code = readFileSync(url, 'utf8');
    texts.push(code);
    // The build writes its imports with double quotes, single quotes or backticks, so all three are allowed.
    for (const match of code.matchAll(/(?:from|import)\s*["'`](\.[^"'`]+\.js)["'`]/g)) read(new URL(match[1], url));
  };
  for (const match of html.matchAll(/<script type="module" src="\/([^"]+)"/g)) read(new URL(match[1], folder));
  return texts.join('\n');
}
