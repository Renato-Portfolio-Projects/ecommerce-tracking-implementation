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
