import { describe, expect, it } from 'vitest';
import { ART } from '../../src/store/art';
import { PRODUCTS } from '../../src/engine/catalog';

describe('src/store/art.ts', () => {
  it('has exactly one drawing for every product in the catalog, no more and no fewer', () => {
    const skus = PRODUCTS.map((product) => product.sku).sort();
    expect(Object.keys(ART).sort()).toEqual(skus);
  });

  it('gives the two-circle mark only to the Logo Tee and the Misprint Tee, and to no trousers', () => {
    for (const [sku, art] of Object.entries(ART)) {
      const printed = sku === 'SI-TEE-002' || sku === 'SI-TEE-003';
      expect(art.print !== 'none', sku).toBe(printed);
      if (art.print !== 'none') expect(art.kind, sku).toBe('tee');
    }
  });

  it('draws each of the three trouser cuts once', () => {
    const trousers = Object.values(ART).filter((art) => art.kind !== 'tee');
    expect(trousers.map((art) => art.kind).sort()).toEqual(['chino', 'pleated', 'relaxed']);
  });
});
