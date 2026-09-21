// The products Second Impression sells. This file is the store's own data. Everything that works
// with it (finding a product, checking the catalog, pricing) is in src/engine.

export type CollectionId = 'tees' | 'pants';
export type Colour = 'Paper' | 'Ink' | 'Red' | 'Blue' | 'Sand';

export interface Variant {
  colour: Colour;
  size: string;
}

export interface Product {
  /**
   * The product's own SKU, unique, like SI-TEE-001. Also the GA4 `item_id`, which stays the same
   * from the first list view to the purchase, because no colour or size is chosen until add to
   * cart. The colour and size travel separately, as `item_variant`.
   */
  sku: string;
  /** The product page address: /products/<slug>. Unique. */
  slug: string;
  /** Also the GA4 `item_name`. */
  name: string;
  /** The collection it is listed under. Filled in from the catalog below, never typed by hand. */
  collection: CollectionId;
  /** What it sells for now, in CAD cents. */
  priceCad: number;
  /** The price before the sale, in CAD cents. Only sale items have one. */
  compareAtCad?: number;
  colours: Colour[];
  /** Letter sizes for tees, waist measurements for pants. */
  sizes: string[];
  /** Variants that are sold out on purpose, so the store can show that state. */
  soldOut: Variant[];
}

/** A product as written under its collection, which supplies the `collection` field. */
export type ProductEntry = Omit<Product, 'collection'>;

/**
 * A named group of products shown together on a page. GA4 calls this an item list, and Meta's
 * catalog tools call it a product set. The order of `products` is the order on the page, so a
 * product's position in a list is its position here.
 */
export interface Collection {
  id: CollectionId;
  /** Also the GA4 `item_category`. */
  name: string;
  products: ProductEntry[];
}

const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const WAIST_SIZES = ['28', '30', '32', '34', '36'];

/** The whole catalog: the collections, each holding its products in page order. */
export const CATALOG: Collection[] = [
  {
    id: 'tees',
    name: 'Tees',
    products: [
      {
        sku: 'SI-TEE-001',
        slug: 'plain-tee',
        name: 'Plain Tee',
        priceCad: 2800,
        colours: ['Paper', 'Ink', 'Blue'],
        sizes: TEE_SIZES,
        soldOut: [],
      },
      {
        sku: 'SI-TEE-002',
        slug: 'logo-tee',
        name: 'Logo Tee',
        priceCad: 3800,
        colours: ['Paper', 'Ink'],
        sizes: TEE_SIZES,
        soldOut: [],
      },
      {
        sku: 'SI-TEE-003',
        slug: 'misprint-tee',
        name: 'Misprint Tee',
        priceCad: 3400,
        compareAtCad: 4200,
        colours: ['Paper', 'Red'],
        sizes: TEE_SIZES,
        soldOut: [{ colour: 'Red', size: 'XL' }],
      },
    ],
  },
  {
    id: 'pants',
    name: 'Pants',
    products: [
      {
        sku: 'SI-PNT-001',
        slug: 'plain-chino',
        name: 'Plain Chino',
        priceCad: 9600,
        colours: ['Sand', 'Ink'],
        sizes: WAIST_SIZES,
        soldOut: [{ colour: 'Sand', size: '28' }],
      },
      {
        sku: 'SI-PNT-002',
        slug: 'relaxed-chino',
        name: 'Relaxed Chino',
        priceCad: 8900,
        compareAtCad: 10800,
        colours: ['Sand', 'Ink'],
        sizes: WAIST_SIZES,
        soldOut: [],
      },
      {
        sku: 'SI-PNT-003',
        slug: 'pleated-chino',
        name: 'Pleated Chino',
        priceCad: 11800,
        colours: ['Paper', 'Blue'],
        sizes: WAIST_SIZES,
        soldOut: [],
      },
    ],
  },
];
