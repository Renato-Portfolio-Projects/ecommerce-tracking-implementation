# Brand notes: Second Impression

Version 0.1. A starting point, refined during the storefront build in v0.2.

## The name

In screen printing, a second impression is a second pass of ink laid over the first. In advertising, a second impression is the second time someone sees an ad, which is what retargeting is. The store is fictional, but the name is meant to hold up on a real clothing label: a brand that asks for a second look. The case study explains the wink in a short "About the name" note.

Tagline: **Worth a second look.**

## The mark

Two overlapping circles in two spot inks, the second printed slightly off the first. `public/favicon.svg` is the first version.

## Colour

The tokens live in `src/styles/tokens.css`, written in OKLCH.

| Token | Role |
|---|---|
| `--paper`, `--paper-shade` | Page and panel backgrounds. Warm off-white, never pure white. |
| `--ink`, `--ink-soft` | Text and dark bars. Warm near-black, never pure black. |
| `--spot-red`, `--spot-blue` | The two spot inks. Used for emphasis and illustration, not for large backgrounds. |

Rule: every neutral leans warm. Text must meet WCAG AA. The spot red on paper is fine for large display text, but check it with a contrast tool before using it at small sizes.

## Type

System fonts for now. The brand pass in v0.2 picks the real ones, and they will be self-hosted, so no request goes to a font server and nothing leaves the site before consent. Direction: a characterful serif for display, a plain sans for body text and labels.

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
