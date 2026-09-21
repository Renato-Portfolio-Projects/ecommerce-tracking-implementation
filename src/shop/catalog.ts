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

/**
 * Where a product sits on a page: which list it was shown in, and its place in that list.
 * The list is one collection's row on the page, and the place counts from 1.
 */
export interface ListContext {
  /** Also the GA4 `item_list_id`. */
  listId: string;
  /** Also the GA4 `item_list_name`. */
  listName: string;
  /** Also the GA4 `index`: the item's place in the list, counting from 1. */
  index: number;
}

/** The most units of one product, colour and size that a cart line may hold. */
export const MAX_QUANTITY_PER_LINE = 10;

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

/** Every product as one flat list, in catalog order, each carrying its collection's id. */
export const PRODUCTS: Product[] = CATALOG.flatMap((collection) =>
  collection.products.map((product) => ({ ...product, collection: collection.id })),
);

export function findCollection(id: string): Collection | undefined {
  return CATALOG.find((collection) => collection.id === id);
}

/** The products in one collection, in page order. Empty for an unknown collection. */
export function productsIn(collectionId: string): Product[] {
  return PRODUCTS.filter((product) => product.collection === collectionId);
}

export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((product) => product.sku === sku);
}

export function findProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function isSoldOut(
  product: { soldOut: Variant[] },
  colour: string,
  size: string,
): boolean {
  return product.soldOut.some((variant) => variant.colour === colour && variant.size === size);
}

/** The GA4 `item_variant` value, for example "Ink / M". */
export function variantLabel(colour: string, size: string): string {
  return `${colour} / ${size}`;
}

/**
 * The SKU of one exact colour and size: the product SKU, the colour in capitals and the size,
 * for example SI-TEE-002-INK-M. It names the item on cart lines and orders. Tracking's
 * `item_id` stays the product SKU.
 */
export function variantSku(sku: string, colour: string, size: string): string {
  return `${sku}-${colour.toUpperCase()}-${size}`;
}

/** Every colour and size a product comes in, colour by colour, sold out or not. */
export function variantsOf(product: { colours: Colour[]; sizes: string[] }): Variant[] {
  return product.colours.flatMap((colour) => product.sizes.map((size) => ({ colour, size })));
}

/**
 * The list context of a product shown in its own collection's row: the list is the collection,
 * and the index is the product's place in it, counting from 1.
 */
export function listContextFor(product: Product): ListContext {
  const collection = findCollection(product.collection)!;
  const place = collection.products.findIndex((entry) => entry.sku === product.sku);
  return { listId: collection.id, listName: collection.name, index: place + 1 };
}

const SKU_PATTERN = /^SI-[A-Z]{3}-\d{3}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateCatalog(collections: Collection[]): string[] {
  const errors: string[] = [];
  const collectionIds = new Set<string>();
  const skus = new Set<string>();
  const slugs = new Set<string>();

  for (const collection of collections) {
    if (collectionIds.has(collection.id)) errors.push(`${collection.id}: duplicate collection id`);
    collectionIds.add(collection.id);
    if (collection.name.trim() === '') errors.push(`${collection.id}: collection name is empty`);
    if (collection.products.length === 0) {
      errors.push(`${collection.id}: collection has no products`);
    }

    for (const product of collection.products) {
      const id = product.sku;

      if (!SKU_PATTERN.test(product.sku)) errors.push(`${id}: sku must look like SI-TEE-001`);
      if (skus.has(product.sku)) errors.push(`${id}: duplicate sku`);
      skus.add(product.sku);

      if (!SLUG_PATTERN.test(product.slug)) {
        errors.push(`${id}: slug must be lowercase words joined by dashes`);
      }
      if (slugs.has(product.slug)) errors.push(`${id}: duplicate slug`);
      slugs.add(product.slug);

      if (product.name.trim() === '') errors.push(`${id}: name is empty`);
      if (!Number.isSafeInteger(product.priceCad) || product.priceCad <= 0) {
        errors.push(`${id}: price must be a positive whole number of cents`);
      }
      if (product.compareAtCad !== undefined && product.compareAtCad <= product.priceCad) {
        errors.push(`${id}: the price before the sale must be higher than the price`);
      }

      if (product.colours.length === 0) errors.push(`${id}: needs at least one colour`);
      if (new Set(product.colours).size !== product.colours.length) {
        errors.push(`${id}: colours repeat`);
      }
      if (product.sizes.length === 0) errors.push(`${id}: needs at least one size`);
      if (new Set(product.sizes).size !== product.sizes.length) errors.push(`${id}: sizes repeat`);

      for (const variant of product.soldOut) {
        if (!product.colours.includes(variant.colour) || !product.sizes.includes(variant.size)) {
          errors.push(
            `${id}: sold-out ${variantLabel(variant.colour, variant.size)} is not an offered variant`,
          );
        }
      }

      const offered = variantsOf(product);
      if (offered.length > 0 && offered.every((v) => isSoldOut(product, v.colour, v.size))) {
        errors.push(`${id}: every variant is sold out`);
      }
    }
  }

  return errors;
}
