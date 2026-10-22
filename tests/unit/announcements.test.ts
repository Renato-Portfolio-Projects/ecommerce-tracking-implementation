import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { productsIn, listContextFor } from '../../src/engine/catalog';
import { pushEvent } from '../../src/tracking/push-event';
import { trackableProduct } from '../../src/tracking/items';
import { HERO_PROMOTION, POPUP_PROMOTION } from '../../src/tracking/promotions';
import {
  selectItemParams,
  selectPromotionParams,
  viewItemListParams,
  viewPromotionParams,
  type ListedProduct,
} from '../../src/tracking/announcements';

// What each announcement carries, checked the way the site will use it: the parameters go to pushEvent, which
// checks them against the tracking plan, so an announcement that is missing or adds a field shows up as a problem.

function layer(): Array<Record<string, unknown>> {
  return globalThis.dataLayer as Array<Record<string, unknown>>;
}

function listed(collectionId: string): ListedProduct[] {
  return productsIn(collectionId).map((product) => ({
    trackable: trackableProduct(product),
    list: listContextFor(product),
  }));
}

beforeEach(() => {
  globalThis.dataLayer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('viewItemListParams', () => {
  it('names the list and holds every product in it, in page order, with its place and its price in the currency shown', () => {
    const params = viewItemListParams(listed('tees'), 'USD');
    expect(params).toBeDefined();
    expect(params?.item_list_id).toBe('tees');
    expect(params?.item_list_name).toBe('Tees');
    expect(params?.items.map((item) => [item.item_id, item.index, item.price])).toStrictEqual([
      ['SI-TEE-001', 1, 20.44],
      ['SI-TEE-002', 2, 27.74],
      ['SI-TEE-003', 3, 24.82],
    ]);
  });

  it('is a complete view_item_list announcement for both collections, with nothing missing and nothing extra', () => {
    for (const collection of ['tees', 'pants']) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('view_item_list', viewItemListParams(listed(collection), 'CAD')!);
      expect(result.problems, collection).toStrictEqual([]);
      expect(layer()).toHaveLength(2);
      expect(layer()[1].ecommerce, collection).toHaveProperty('item_list_id', collection);
    }
  });

  it('gives nothing for a list with no products', () => {
    expect(viewItemListParams([], 'CAD')).toBeUndefined();
  });
});

describe('selectItemParams', () => {
  it('names the list the card is in and holds the one product, with its place', () => {
    const [, logoTee] = listed('tees');
    const params = selectItemParams(logoTee, 'EUR');
    expect(params.item_list_id).toBe('tees');
    expect(params.item_list_name).toBe('Tees');
    expect(params.items).toStrictEqual([
      {
        item_id: 'SI-TEE-002',
        item_name: 'Logo Tee',
        item_category: 'Tees',
        price: 25.08,
        item_list_id: 'tees',
        item_list_name: 'Tees',
        index: 2,
      },
    ]);
  });

  it('is a complete select_item announcement', () => {
    const result = pushEvent('select_item', selectItemParams(listed('pants')[0], 'GBP'));
    expect(result.problems).toStrictEqual([]);
  });
});

describe('viewPromotionParams and selectPromotionParams', () => {
  it('carry the three promotion fields, and a view adds the source when there is one', () => {
    expect(viewPromotionParams(POPUP_PROMOTION, 'auto')).toStrictEqual({ ...POPUP_PROMOTION, source: 'auto' });
    expect(viewPromotionParams(HERO_PROMOTION)).toStrictEqual({ ...HERO_PROMOTION });
    expect(selectPromotionParams(HERO_PROMOTION)).toStrictEqual({ ...HERO_PROMOTION });
  });

  it('are complete announcements for both promotions', () => {
    for (const promotion of [HERO_PROMOTION, POPUP_PROMOTION]) {
      expect(pushEvent('view_promotion', viewPromotionParams(promotion, 'manual')).problems, promotion.promotion_id).toStrictEqual([]);
      expect(pushEvent('select_promotion', selectPromotionParams(promotion)).problems, promotion.promotion_id).toStrictEqual([]);
    }
  });

  it('never send a source with a selection, which the plan sends only with a view', () => {
    expect(selectPromotionParams(POPUP_PROMOTION)).not.toHaveProperty('source');
  });
});
