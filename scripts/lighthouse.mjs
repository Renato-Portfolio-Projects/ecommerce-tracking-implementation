// Runs Lighthouse against the built store, on a phone-sized screen, and checks the scores against the
// budgets in docs/brand.md. It is run by hand (npm run lighthouse), not in CI: a real browser and a
// stable machine are needed for a fair score, which a CI runner does not reliably give. Chrome must be
// installed. See "Speed and accessibility budgets" in docs/brand.md for the numbers and the reasoning.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const ROOT = fileURLToPath(new URL('../dist-store/', import.meta.url));
const PORT = 4600;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const PAGES = ['/', '/about', '/policies/shipping', '/style-guide'];

/**
 * The first Markdown table under a heading: each row as a list of trimmed cells, the header and the
 * separator row left out.
 */
function tableUnderHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`Heading not found: ${heading}`);
  const rows = [];
  let inTable = false;
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      inTable = true;
      rows.push(
        trimmed
          .slice(1, trimmed.endsWith('|') ? -1 : undefined)
          .split('|')
          .map((cell) => cell.trim()),
      );
    } else if (inTable) {
      break;
    }
  }
  return rows.slice(2);
}

/** The budgets from docs/brand.md, read here so the script and the page can never disagree. */
export function readBudgets(brandNotes) {
  const budgets = {};
  for (const [metric, value] of tableUnderHeading(brandNotes, '## Speed and accessibility budgets')) {
    budgets[metric.replace(/`/g, '')] = value;
  }
  return budgets;
}

/** The same file Astro's own build would answer an address with: index.html at the root, or exactly as named. */
export function fileFor(pathname) {
  if (pathname === '/' || pathname === '') return 'index.html';
  if (extname(pathname)) return pathname;
  return `${pathname.replace(/\/$/, '')}/index.html`;
}

function serveOnce(root, port) {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const candidates = [fileFor(pathname), pathname === '/' ? null : '404.html'].filter(Boolean);
    for (const [index, candidate] of candidates.entries()) {
      try {
        const data = readFileSync(join(root, candidate));
        res.writeHead(index === 0 ? 200 : 404, { 'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream' });
        res.end(data);
        return;
      } catch {
        // try the next candidate
      }
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function run() {
  const server = await serveOnce(ROOT, PORT);
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const results = [];
  try {
    for (const page of PAGES) {
      const url = `http://127.0.0.1:${PORT}${page}`;
      const report = await lighthouse(
        url,
        { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'] },
        { extends: 'lighthouse:default', settings: { formFactor: 'mobile', screenEmulation: { mobile: true, width: 375, height: 667, deviceScaleFactor: 2 } } },
      );
      const categories = report.lhr.categories;
      const jsBytes = Object.values(report.lhr.audits['network-requests']?.details?.items ?? [])
        .filter((item) => item.resourceType === 'Script')
        .reduce((sum, item) => sum + (item.transferSize ?? 0), 0);
      results.push({
        page,
        performance: Math.round(categories.performance.score * 100),
        accessibility: Math.round(categories.accessibility.score * 100),
        bestPractices: Math.round(categories['best-practices'].score * 100),
        jsKB: Math.round(jsBytes / 1024),
      });
    }
  } finally {
    await chrome.kill();
    server.close();
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const brandNotes = readFileSync(new URL('../docs/brand.md', import.meta.url), 'utf8');
  const budgets = readBudgets(brandNotes);
  console.log('Budgets from docs/brand.md:', budgets);
  const results = await run();
  console.log('\nPage'.padEnd(24), 'Performance', 'Accessibility', 'Best Practices', 'JS (KB)');
  for (const r of results) {
    console.log(r.page.padEnd(24), String(r.performance).padEnd(12), String(r.accessibility).padEnd(14), String(r.bestPractices).padEnd(15), r.jsKB);
  }
}
