import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartLine } from '../../src/engine/cart';
import { findProduct, productsIn, listContextFor } from '../../src/engine/catalog';
import { pushEvent } from '../../src/tracking/push-event';
import { trackableProduct } from '../../src/tracking/items';
import { HERO_PROMOTION, POPUP_PROMOTION } from '../../src/tracking/promotions';
import {
  cartChangeAnnouncements,
  cartParams,
  selectItemParams,
  selectPromotionParams,
  viewItemListParams,
  viewItemParams,
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

describe('viewItemParams', () => {
  const logoTee = trackableProduct(findProduct('SI-TEE-002')!);

  it('is the one product with its price in the currency shown, and that price as the value', () => {
    expect(viewItemParams(logoTee, 'USD')).toStrictEqual({
      currency: 'USD',
      value: 27.74,
      items: [{ item_id: 'SI-TEE-002', item_name: 'Logo Tee', item_category: 'Tees', price: 27.74 }],
    });
  });

  it('is a complete view_item announcement, with no colour, size or list, since none is chosen yet', () => {
    const result = pushEvent('view_item', viewItemParams(logoTee, 'CAD'));
    expect(result.problems).toStrictEqual([]);
    expect(layer()).toHaveLength(2);
    const item = (layer()[1].ecommerce as { items: Record<string, unknown>[] }).items[0];
    expect(item).not.toHaveProperty('item_variant');
    expect(item).not.toHaveProperty('quantity');
    expect(item).not.toHaveProperty('index');
  });
});

describe('cartParams', () => {
  const tees = listContextFor(findProduct('SI-TEE-002')!);
  const lines: CartLine[] = [
    { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: tees },
    { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
  ];

  it('holds the lines as items, the value of them all, and the currency', () => {
    const params = cartParams(lines, 'CAD');
    expect(params?.currency).toBe('CAD');
    expect(params?.value).toBe(172);
    expect(params?.items.map((item) => [item.item_id, item.item_variant, item.quantity, item.price])).toStrictEqual([
      ['SI-TEE-002', 'Ink / M', 2, 38],
      ['SI-PNT-001', 'Ink / 32', 1, 96],
    ]);
    expect(params?.items[0]).toMatchObject({ item_list_id: 'tees', item_list_name: 'Tees', index: 2 });
  });

  it('prices in the currency shown', () => {
    expect(cartParams(lines, 'EUR')?.value).toBe(113.52);
  });

  it('is a complete add_to_cart, remove_from_cart and view_cart announcement', () => {
    for (const event of ['add_to_cart', 'remove_from_cart', 'view_cart']) {
      globalThis.dataLayer = undefined;
      const result = pushEvent(event, cartParams(lines, 'USD')!);
      expect(result.problems, event).toStrictEqual([]);
    }
  });

  it('gives nothing for no lines, so an empty cart announces nothing', () => {
    expect(cartParams([], 'CAD')).toBeUndefined();
  });
});

describe('cartChangeAnnouncements', () => {
  const went: CartLine[] = [{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 }];
  const came: CartLine[] = [{ sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 }];

  it('announces nothing for a change that carries no changes, which is how the cart says an order emptied it', () => {
    expect(cartChangeAnnouncements(undefined, 'CAD')).toStrictEqual([]);
  });

  it('announces nothing when no units moved', () => {
    expect(cartChangeAnnouncements({ added: [], removed: [] }, 'CAD')).toStrictEqual([]);
  });

  it('announces the units that went in as an add_to_cart, and nothing else', () => {
    expect(cartChangeAnnouncements({ added: went, removed: [] }, 'CAD')).toStrictEqual([
      { event: 'add_to_cart', params: cartParams(went, 'CAD') },
    ]);
  });

  it('announces the units that came out as a remove_from_cart, and nothing else', () => {
    expect(cartChangeAnnouncements({ added: [], removed: came }, 'CAD')).toStrictEqual([
      { event: 'remove_from_cart', params: cartParams(came, 'CAD') },
    ]);
  });

  it('announces both when both happened, the units that went in first', () => {
    const events = cartChangeAnnouncements({ added: went, removed: came }, 'CAD').map((announcement) => announcement.event);
    expect(events).toStrictEqual(['add_to_cart', 'remove_from_cart']);
  });

  it('prices what it announces in the currency given', () => {
    const [add] = cartChangeAnnouncements({ added: went, removed: [] }, 'EUR');
    expect(add.params.currency).toBe('EUR');
    expect(add.params.value).toBe(50.16);
  });

  it('makes complete announcements, with nothing missing and nothing extra', () => {
    for (const { event, params } of cartChangeAnnouncements({ added: went, removed: came }, 'USD')) {
      globalThis.dataLayer = undefined;
      expect(pushEvent(event, params).problems, event).toStrictEqual([]);
    }
  });
});
