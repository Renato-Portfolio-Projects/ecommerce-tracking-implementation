/**
 * The two promotions the store runs, as GA4 describes a promotion: an id, a name and the creative that carried
 * it. They are tracking labels, not words a shopper reads, so they live here and are written into the pages that
 * carry the promotion as data (`data-track-promotion`) when the site is built.
 */
export interface Promotion {
  promotion_id: string;
  promotion_name: string;
  creative_name: string;
}

/** The banner at the top of the home page. */
export const HERO_PROMOTION: Promotion = {
  promotion_id: 'home-hero',
  promotion_name: 'New in',
  creative_name: 'Home hero',
};

/** The welcome offer in the lead popup. */
export const POPUP_PROMOTION: Promotion = {
  promotion_id: 'welcome-offer',
  promotion_name: 'Welcome offer',
  creative_name: 'Lead popup',
};

/** Reads what a page carries about a promotion. Anything missing, damaged or incomplete gives nothing instead of throwing. */
export function parsePromotion(raw: string | undefined): Promotion | undefined {
  if (raw === undefined || raw === '') return undefined;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;

  const { promotion_id, promotion_name, creative_name } = data as Record<string, unknown>;
  for (const field of [promotion_id, promotion_name, creative_name]) {
    if (typeof field !== 'string' || field === '') return undefined;
  }
  return { promotion_id, promotion_name, creative_name } as Promotion;
}
