export type StackCategory = 'site' | 'tracking' | 'testing' | 'repo';
export type DataTouched = 'none' | 'anonymous' | 'hashed-personal' | 'personal';
export type ConsentCategory = 'none' | 'necessary' | 'analytics' | 'marketing';
export type StackStatus = 'planned' | 'understood' | 'verified';

export interface StackEntry {
  /** Unique, kebab-case. */
  id: string;
  name: string;
  category: StackCategory;
  /** One plain sentence: what this tool does in this project. */
  role: string;
  /** The plan we use, for example "Free" or "Hobby (free, non-commercial)". */
  plan: string;
  /** Yearly cost in US dollars. Only the domain may be above zero. */
  annualCostUsd: number;
  /** What visitor data the tool can see. */
  dataTouched: DataTouched;
  /** The consent category that has to be granted before it runs. */
  consent: ConsentCategory;
  /** Nothing is "verified" until there is evidence to point at. */
  status: StackStatus;
  /** A commit, test, file or screenshot. Required when status is "verified". */
  evidence?: string;
}

export const STACK: StackEntry[] = [
  // Site and infrastructure
  {
    id: 'astro',
    name: 'Astro',
    category: 'site',
    role: 'Builds the storefront as ordinary multi-page HTML.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    category: 'site',
    role: 'Type-checks the site and test code.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'site',
    role: 'Hosts the site and runs the small API endpoints.',
    plan: 'Hobby (free, non-commercial)',
    annualCostUsd: 0,
    dataTouched: 'anonymous',
    consent: 'necessary',
    status: 'planned',
  },
  {
    id: 'upstash-redis',
    name: 'Upstash Redis',
    category: 'site',
    role: 'Keeps leads, orders and tracking receipts for 7 days, then deletes them.',
    plan: 'Free (500K commands a month)',
    annualCostUsd: 0,
    dataTouched: 'personal',
    consent: 'necessary',
    status: 'planned',
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    category: 'site',
    role: 'Registers the domain and hosts its DNS records.',
    plan: 'Domain only (secondimpression.ca)',
    // Namecheap's price for secondimpression.ca on 2026-09-19: USD 11.98 a year.
    // Renato's card was charged CAD 16.78 after conversion. The renewal price is the
    // same (confirmed by Renato on 2026-09-20) and auto-renew is on, so this is what
    // the domain costs over time.
    annualCostUsd: 11.98,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'site',
    role: 'Runs the build and the tests.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },

  // Tracking
  {
    id: 'gtm-web',
    name: 'Google Tag Manager (web container)',
    category: 'tracking',
    role: 'Fires every tag from dataLayer events. Loads only after opt-in (revisited in v0.3).',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'anonymous',
    consent: 'analytics',
    status: 'planned',
  },
  {
    id: 'gtm-server',
    name: 'Google Tag Manager (server container on Stape)',
    category: 'tracking',
    role: 'Receives the four key events and forwards them to Meta.',
    plan: 'Stape Free (10K requests a month)',
    annualCostUsd: 0,
    dataTouched: 'hashed-personal',
    consent: 'marketing',
    status: 'planned',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    category: 'tracking',
    role: 'Reports on every event in the funnel.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'anonymous',
    consent: 'analytics',
    status: 'planned',
  },
  {
    id: 'meta-pixel',
    name: 'Meta Pixel',
    category: 'tracking',
    role: 'Sends browser-side events to Meta.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'anonymous',
    consent: 'marketing',
    status: 'planned',
  },
  {
    id: 'meta-conversions-api',
    name: 'Meta Conversions API',
    category: 'tracking',
    role: 'Sends the same key events from the server, matched to the pixel by event_id.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'hashed-personal',
    consent: 'marketing',
    status: 'planned',
  },
  {
    id: 'consent-banner',
    name: 'Custom consent banner (Consent Mode v2, basic)',
    category: 'tracking',
    role: 'Asks for consent and blocks every tag until it is given.',
    plan: 'Built in this repo',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'necessary',
    status: 'planned',
  },

  // Testing and QA
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'testing',
    role: 'Walks the funnel in a real browser and checks every dataLayer event and consent rule.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'gtm-preview',
    name: 'GTM Preview (Tag Assistant)',
    category: 'testing',
    role: 'Shows which tags fired, and why, in a live session.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'ga4-debugview',
    name: 'GA4 DebugView',
    category: 'testing',
    role: 'Shows GA4 events arriving in real time.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'meta-test-events',
    name: 'Meta Events Manager (Test events)',
    category: 'testing',
    role: 'Shows browser and server events and whether they were deduplicated.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'meta-pixel-helper',
    name: 'Meta Pixel Helper',
    category: 'testing',
    role: 'Browser extension that shows each pixel call and its errors.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'lighthouse-ci',
    name: 'Lighthouse CI',
    category: 'testing',
    role: 'Checks performance, accessibility and best-practice budgets on every push.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'gitleaks',
    name: 'gitleaks',
    category: 'testing',
    role: 'Scans commits for secrets, before commit and in CI.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'link-checker',
    name: 'lychee',
    category: 'testing',
    role: 'Finds broken links in the docs and the site.',
    plan: 'Free, open source',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },

  // Repo and development
  {
    id: 'github',
    name: 'GitHub',
    category: 'repo',
    role: 'Hosts the repo, runs CI, and provides secret scanning and push protection.',
    plan: 'Free (public repo)',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'repo',
    role: 'AI-assisted development, directed and reviewed by Renato.',
    plan: 'Existing subscription',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    category: 'repo',
    role: 'Code editor.',
    plan: 'Free',
    annualCostUsd: 0,
    dataTouched: 'none',
    consent: 'none',
    status: 'planned',
  },
];

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns a list of problems. An empty list means the entries are valid. */
export function validateStack(entries: StackEntry[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!KEBAB_CASE.test(entry.id)) errors.push(`${entry.id}: id must be kebab-case`);
    if (seen.has(entry.id)) errors.push(`${entry.id}: duplicate id`);
    seen.add(entry.id);

    if (entry.name.trim() === '') errors.push(`${entry.id}: name is empty`);
    if (entry.role.trim() === '') errors.push(`${entry.id}: role is empty`);
    if (entry.annualCostUsd < 0) errors.push(`${entry.id}: cost cannot be negative`);
    if (entry.annualCostUsd > 0 && entry.id !== 'namecheap') {
      errors.push(`${entry.id}: only the domain may cost money`);
    }
    if (entry.status === 'verified' && !entry.evidence?.trim()) {
      errors.push(`${entry.id}: verified needs evidence`);
    }
    if (entry.dataTouched !== 'none' && entry.consent === 'none') {
      errors.push(`${entry.id}: touches data but has no consent category`);
    }
  }

  return errors;
}
