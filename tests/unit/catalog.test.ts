import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  MAX_QUANTITY_PER_LINE,
  PRODUCTS,
  findCollection,
  findProduct,
  findProductBySlug,
  isSoldOut,
  productsIn,
  validateCatalog,
  variantLabel,
  type Collection,
  type ProductEntry,
} from '../../src/shop/catalog';

const valid: ProductEntry = {
  sku: 'SI-TEE-999',
  slug: 'example-tee',
  name: 'Example Tee',
  priceCad: 3000,
  colours: ['Paper', 'Ink'],
  sizes: ['S', 'M'],
  soldOut: [],
};

/** A catalog with one collection holding the given products. */
function catalogOf(...products: ProductEntry[]): Collection[] {
  return [{ id: 'tees', name: 'Tees', products }];
}

describe('validateCatalog', () => {
  it('accepts a well-formed catalog', () => {
    expect(validateCatalog(catalogOf(valid))).toEqual([]);
  });

  it('rejects duplicate SKUs and duplicate slugs', () => {
    const errors = validateCatalog(catalogOf(valid, valid));
    expect(errors).toContain('SI-TEE-999: duplicate sku');
    expect(errors).toContain('SI-TEE-999: duplicate slug');
  });

  it('rejects a SKU or slug that repeats in another collection', () => {
    const errors = validateCatalog([
      { id: 'tees', name: 'Tees', products: [valid] },
      { id: 'pants', name: 'Pants', products: [valid] },
    ]);
    expect(errors).toContain('SI-TEE-999: duplicate sku');
    expect(errors).toContain('SI-TEE-999: duplicate slug');
  });

  it('rejects a SKU that does not follow the pattern', () => {
    expect(validateCatalog(catalogOf({ ...valid, sku: 'tee-1' }))).toContain(
      'tee-1: sku must look like SI-TEE-001',
    );
  });

  it('rejects a slug that is not lowercase with dashes', () => {
    expect(validateCatalog(catalogOf({ ...valid, slug: 'Example Tee' }))).toContain(
      'SI-TEE-999: slug must be lowercase words joined by dashes',
    );
  });

  it('rejects a price that is not a positive whole number of cents', () => {
    const message = 'SI-TEE-999: price must be a positive whole number of cents';
    expect(validateCatalog(catalogOf({ ...valid, priceCad: 0 }))).toContain(message);
    expect(validateCatalog(catalogOf({ ...valid, priceCad: 30.5 }))).toContain(message);
  });

  it('requires a sale item to have a higher price before the sale', () => {
    const message = 'SI-TEE-999: the price before the sale must be higher than the price';
    expect(validateCatalog(catalogOf({ ...valid, compareAtCad: 3000 }))).toContain(message);
    expect(validateCatalog(catalogOf({ ...valid, compareAtCad: 4000 }))).toEqual([]);
  });

  it('requires colours and sizes, without repeats', () => {
    expect(validateCatalog(catalogOf({ ...valid, colours: [] }))).toContain(
      'SI-TEE-999: needs at least one colour',
    );
    expect(validateCatalog(catalogOf({ ...valid, sizes: ['S', 'S'] }))).toContain(
      'SI-TEE-999: sizes repeat',
    );
    expect(validateCatalog(catalogOf({ ...valid, colours: ['Ink', 'Ink'] }))).toContain(
      'SI-TEE-999: colours repeat',
    );
  });

  it('only marks a variant sold out when the product offers it', () => {
    expect(
      validateCatalog(catalogOf({ ...valid, soldOut: [{ colour: 'Red', size: 'S' }] })),
    ).toContain('SI-TEE-999: sold-out Red / S is not an offered variant');
    expect(
      validateCatalog(catalogOf({ ...valid, soldOut: [{ colour: 'Ink', size: 'XL' }] })),
    ).toContain('SI-TEE-999: sold-out Ink / XL is not an offered variant');
  });

  it('refuses a product with every variant sold out', () => {
    const everything = valid.colours.flatMap((colour) =>
      valid.sizes.map((size) => ({ colour, size })),
    );
    expect(validateCatalog(catalogOf({ ...valid, soldOut: everything }))).toContain(
      'SI-TEE-999: every variant is sold out',
    );
  });

  it('refuses an empty collection, a nameless one, and a repeated collection id', () => {
    const errors = validateCatalog([
      { id: 'tees', name: 'Tees', products: [valid] },
      { id: 'tees', name: ' ', products: [] },
    ]);
    expect(errors).toContain('tees: duplicate collection id');
    expect(errors).toContain('tees: collection name is empty');
    expect(errors).toContain('tees: collection has no products');
  });
});

describe('CATALOG', () => {
  it('passes validation', () => {
    expect(validateCatalog(CATALOG)).toEqual([]);
  });

  it('has two collections, Tees and Pants, each holding its three products in page order', () => {
    expect(
      CATALOG.map((collection) => [
        collection.id,
        collection.name,
        collection.products.map((product) => product.name),
      ]),
    ).toEqual([
      ['tees', 'Tees', ['Plain Tee', 'Logo Tee', 'Misprint Tee']],
      ['pants', 'Pants', ['Plain Chino', 'Relaxed Chino', 'Pleated Chino']],
    ]);
  });
});

describe('PRODUCTS', () => {
  it('lists every product once, in catalog order, each knowing its collection', () => {
    expect(PRODUCTS.map((product) => [product.collection, product.sku])).toEqual([
      ['tees', 'SI-TEE-001'],
      ['tees', 'SI-TEE-002'],
      ['tees', 'SI-TEE-003'],
      ['pants', 'SI-PNT-001'],
      ['pants', 'SI-PNT-002'],
      ['pants', 'SI-PNT-003'],
    ]);
  });

  it('has the six approved products, in order, at the approved prices', () => {
    expect(
      PRODUCTS.map((product) => [
        product.sku,
        product.name,
        product.collection,
        product.priceCad,
        product.compareAtCad,
      ]),
    ).toEqual([
      ['SI-TEE-001', 'Plain Tee', 'tees', 2800, undefined],
      ['SI-TEE-002', 'Logo Tee', 'tees', 3800, undefined],
      ['SI-TEE-003', 'Misprint Tee', 'tees', 3400, 4200],
      ['SI-PNT-001', 'Plain Chino', 'pants', 9600, undefined],
      ['SI-PNT-002', 'Relaxed Chino', 'pants', 8900, 10800],
      ['SI-PNT-003', 'Pleated Chino', 'pants', 11800, undefined],
    ]);
  });

  it('offers the approved colours and sizes', () => {
    const offered = Object.fromEntries(
      PRODUCTS.map((product) => [product.sku, [product.colours, product.sizes]]),
    );
    const teeSizes = ['XS', 'S', 'M', 'L', 'XL'];
    const waists = ['28', '30', '32', '34', '36'];
    expect(offered).toEqual({
      'SI-TEE-001': [['Paper', 'Ink', 'Blue'], teeSizes],
      'SI-TEE-002': [['Paper', 'Ink'], teeSizes],
      'SI-TEE-003': [['Paper', 'Red'], teeSizes],
      'SI-PNT-001': [['Sand', 'Ink'], waists],
      'SI-PNT-002': [['Sand', 'Ink'], waists],
      'SI-PNT-003': [['Paper', 'Blue'], waists],
    });
  });

  it('has exactly two sale items, one per collection', () => {
    const onSale = PRODUCTS.filter((product) => product.compareAtCad !== undefined);
    expect(onSale.map((product) => product.name)).toEqual(['Misprint Tee', 'Relaxed Chino']);
  });

  it('has exactly two variants sold out, so the store can show a sold-out state', () => {
    const soldOut = PRODUCTS.flatMap((product) =>
      product.soldOut.map(
        (variant) => `${product.name}: ${variantLabel(variant.colour, variant.size)}`,
      ),
    );
    expect(soldOut).toEqual(['Misprint Tee: Red / XL', 'Plain Chino: Sand / 28']);
  });
});

describe('lookups', () => {
  it('finds a product by SKU or by slug', () => {
    expect(findProduct('SI-TEE-002')?.name).toBe('Logo Tee');
    expect(findProductBySlug('relaxed-chino')?.sku).toBe('SI-PNT-002');
  });

  it('returns nothing for an unknown SKU or slug', () => {
    expect(findProduct('SI-XXX-000')).toBeUndefined();
    expect(findProductBySlug('nope')).toBeUndefined();
  });

  it('finds a collection by id', () => {
    expect(findCollection('pants')?.name).toBe('Pants');
    expect(findCollection('nope')).toBeUndefined();
  });

  it("lists a collection's products in page order", () => {
    expect(productsIn('tees').map((product) => product.sku)).toEqual([
      'SI-TEE-001',
      'SI-TEE-002',
      'SI-TEE-003',
    ]);
    expect(productsIn('pants').every((product) => product.collection === 'pants')).toBe(true);
    expect(productsIn('nope')).toEqual([]);
  });
});

describe('isSoldOut', () => {
  const misprint = findProduct('SI-TEE-003')!;

  it('is true only for the variants marked sold out', () => {
    expect(isSoldOut(misprint, 'Red', 'XL')).toBe(true);
    expect(isSoldOut(misprint, 'Red', 'L')).toBe(false);
    expect(isSoldOut(misprint, 'Paper', 'XL')).toBe(false);
    expect(isSoldOut(findProduct('SI-PNT-001')!, 'Sand', '28')).toBe(true);
  });
});

describe('variantLabel', () => {
  it('joins colour and size the way GA4 receives item_variant', () => {
    expect(variantLabel('Ink', 'M')).toBe('Ink / M');
    expect(variantLabel('Sand', '32')).toBe('Sand / 32');
  });
});

describe('MAX_QUANTITY_PER_LINE', () => {
  it('is ten', () => {
    expect(MAX_QUANTITY_PER_LINE).toBe(10);
  });
});
