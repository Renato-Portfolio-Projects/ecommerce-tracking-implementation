/**
 * The labels a call to action can carry in its `data-cta` attribute. A click on an element with one is announced as
 * a `cta_click`, and the label is its `cta_location`. They are written as "Area - Item", the way the first three
 * were, and kept in one list so that tests can check three things: that every label on the built pages is in it,
 * that every label in it is on a built page, and that docs/tracking-plan.md lists the same ones in the same order.
 *
 * Only a call to action with no event of its own is labelled. A product card, the Checkout button and the currency
 * selector already announce themselves, the popup's main button is a `select_promotion`, and a link inside the body
 * of a page is not one the business counts.
 */
export const CTA_LABELS = [
  'Lead Popup - Footer link',
  'Lead Popup - Corner tab',
  'Demo Data - Lead popup',
  'Header - Logo',
  'Nav - Tees',
  'Nav - Pants',
  'Nav - About',
  'Footer - GitHub',
  'Footer - Production guide',
  'Footer - Shipping',
  'Footer - Returns',
  'Footer - Terms',
  'Footer - Contact',
  'Demo bar - Project link',
  'Cart drawer - Keep shopping',
  'Cart page - Keep shopping',
  'Thank you - Keep shopping',
  'Demo Data - Checkout contact',
  'Demo Data - Checkout address',
  'Test Card - Checkout payment',
] as const;

export type CtaLabel = (typeof CTA_LABELS)[number];
