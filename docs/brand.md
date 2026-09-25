# Brand notes: Second Impression

Version 0.2. The look chosen for the storefront build in v0.2.

## The name

In screen printing, a second impression is a second pass of ink laid over the first. In advertising, a second impression is the second time someone sees an ad, which is what retargeting is. The store is fictional, but the name is meant to hold up on a real clothing label: a brand that asks for a second look. The case study explains the wink in a short "About the name" note.

Tagline: **Worth a second look.**

## The mark

Two overlapping circles in two spot inks, the second printed slightly off the first. `public/favicon.svg` is the first version.

## Colour

The tokens live in `src/styles/tokens.css`, written in OKLCH, and a test checks this table against them.

| Token | Value | Role |
|---|---|---|
| `--paper` | `oklch(96% 0.014 85)` | The page background. Warm off-white, never pure white. |
| `--paper-shade` | `oklch(92% 0.02 85)` | Panels, and the picture behind a product. |
| `--ink` | `oklch(24% 0.02 60)` | Text and the dark bars. Warm near-black, never pure black. |
| `--ink-soft` | `oklch(42% 0.02 60)` | Secondary text and small labels. |
| `--spot-red` | `oklch(60% 0.19 32)` | The first spot ink. Large headlines, the wordmark, drawings and fills. Not for small text. |
| `--spot-red-text` | `oklch(52% 0.19 32)` | The same red, darker, for small text such as a sale price. |
| `--spot-blue` | `oklch(45% 0.13 255)` | The second spot ink. Buttons, links and the focus ring. |
| `--sand` | `oklch(78% 0.06 80)` | A garment colour for the drawings. Never used for text. |

Rule: every neutral leans warm. Text must meet WCAG AA, and the next section says how that is checked.

## Contrast

Text has to reach 4.5 to 1 against its background under WCAG 2.x AA. Large text (from 24 px, or from about 19 px in bold) and the outlines of controls only need 3 to 1. A test works out every ratio below from the tokens, and checks that each pair meets what it needs.

| Text | On | Used for | Ratio | Needs |
|---|---|---|---|---|
| `--ink` | `--paper` | Body text | 14.69 | 4.5 |
| `--ink-soft` | `--paper` | Secondary text and labels | 7.57 | 4.5 |
| `--ink` | `--paper-shade` | Text on a panel | 13.03 | 4.5 |
| `--ink-soft` | `--paper-shade` | Secondary text on a panel | 6.71 | 4.5 |
| `--paper` | `--ink` | Text on the demo bar and the footer | 14.69 | 4.5 |
| `--paper` | `--spot-blue` | Button labels | 6.68 | 4.5 |
| `--spot-blue` | `--paper` | Links and the focus ring | 6.68 | 4.5 |
| `--spot-red-text` | `--paper` | Small red text, such as a sale price | 5.39 | 4.5 |
| `--spot-red-text` | `--paper-shade` | Small red text on a panel | 4.78 | 4.5 |
| `--spot-red` | `--paper` | The wordmark and large headlines | 3.84 | 3 |
| `--spot-red` | `--paper-shade` | Large headlines on a panel | 3.41 | 3 |

The bright red, `--spot-red`, is for large things only. Small red text uses `--spot-red-text`. Buttons are blue with paper text, not red.

## Type

Two fonts, both under the SIL Open Font License, self-hosted as Latin subsets so that no request goes to a font server before a visitor has chosen anything. The files and their licences are in `src/assets/fonts`, the `@font-face` rules are in `src/styles/fonts.css`, and a test keeps this table, the rules and the files in step. Together they stay under 60 KB.

| Role | Family | Weights | Licence |
|---|---|---|---|
| Display: the wordmark, headlines and product names | Fraunces | 700 | `src/assets/fonts/LICENSE-Fraunces.txt` |
| Body: text, labels, buttons and prices | Public Sans | 400, 600 | `src/assets/fonts/LICENSE-Public-Sans.txt` |

The display face is only used in bold, because that is the one weight that is loaded. Before the fonts arrive, the page shows the system fonts named after them in `src/styles/tokens.css`, and the first two files are preloaded so that the swap is short.

## Illustration

Flat vector garments, drawn in code.

- Flat fills in the two spot inks, plus ink and paper.
- A slight misregistration: a second copy of each shape, offset by about 1.5% and multiplied over the first.
- No gradients and no photography.

## Voice

Plain and short. Say what the thing is and what it costs. Be honest that it is a demo wherever that matters: the demo bar, the footer and the policy pages.

Avoid: cutting-edge, innovative, leverage, unlock, seamless, robust, holistic, empower, utilize.

## The demo notice

The bar on every storefront page reads: "Portfolio demo store: fictional products, no real payments."

## Speed and accessibility budgets

`npm run lighthouse` runs Lighthouse against the built store on a phone-sized screen, served with its functions running and pretending to be in France, and checks these numbers. It is run by hand, not in CI, because Lighthouse needs a real browser and a quiet machine for a fair score, which the roadmap leaves for v1.0 to add to CI. The numbers below were confirmed by running it once the store's pages existed, on 2026-09-21.

| Metric | Budget |
|---|---|
| Performance (mobile) | 95 or more |
| Accessibility (mobile) | 100 |
| Best Practices (mobile) | 95 or more |
| JavaScript on a page | 30 KB or less |

The JavaScript figure is what a page loads on its own, and it is what `npm run lighthouse` counts. The lead popup's form is loaded only when the popup is first shown, so it is on top of that figure: it is 5.7 KB (2.5 KB compressed), which puts a store page at about 28 KB and a product page at about 30 KB (29.6 KB, counted as the files are sent) once it has loaded. That is under the budget with almost no room, since the starting currency added 0.7 KB in v0.2c-1, so the tag scripts of v0.2d will need a rule of their own for how they are counted.

Every page also has to reach the Core Web Vitals "good" band: Largest Contentful Paint within 2.5 seconds, Interaction to Next Paint at 200 milliseconds or less, and Cumulative Layout Shift at 0.1 or less ([web.dev: Web Vitals](https://web.dev/articles/vitals), last updated 2024-10-31). Lighthouse's Performance score reflects these on the page it tests, but they are only truly measured from real visits, which this portfolio does not have yet.
