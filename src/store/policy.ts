// The store's own choices about how a cart behaves and how its SKUs are written. Each is a business
// decision that another store might make differently, so they live here and not in src/engine.

/** The most units of one product, colour and size that a cart line may hold. */
export const MAX_QUANTITY_PER_LINE = 10;

/**
 * The most different lines one cart may hold. This is a safety guard, not a business rule, so it
 * can be raised freely. The most units of one line is MAX_QUANTITY_PER_LINE.
 */
export const MAX_CART_LINES = 20;

/** How long a saved cart is kept, counted from the last time it was saved. */
export const CART_LIFETIME_DAYS = 7;

/** What a product SKU looks like, for example SI-TEE-001. The catalog check uses it. */
export const SKU_PATTERN = /^SI-[A-Z]{3}-\d{3}$/;

/**
 * How long the lead popup stays quiet after it has been shown, counted from the last time it was
 * shown, whether the visitor closed it or took the code. It matches CART_LIFETIME_DAYS on purpose:
 * this demo keeps a lead for seven days, so the popup forgets a visitor on the same clock.
 */
export const LEAD_POPUP_INTERVAL_DAYS = 7;

/**
 * How long after arriving on the home page the lead popup opens by itself, if the visitor has not
 * scrolled far enough first. Five seconds is a deliberate demo setting, so a reviewer sees the popup
 * quickly. A real store would wait longer, and popup guidance usually suggests 30 to 60 seconds.
 */
export const LEAD_POPUP_DELAY_SECONDS = 5;

/** How far down the page, as a percentage of the way, the visitor must scroll to open the lead popup by itself. */
export const LEAD_POPUP_SCROLL_PERCENT = 40;
