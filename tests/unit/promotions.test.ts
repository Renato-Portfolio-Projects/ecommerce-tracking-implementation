import { describe, expect, it } from 'vitest';
import { HERO_PROMOTION, POPUP_PROMOTION, parsePromotion } from '../../src/tracking/promotions';

describe('the two promotions', () => {
  it('are the hero banner and the welcome popup, each with an id, a name and a creative', () => {
    expect(HERO_PROMOTION).toStrictEqual({
      promotion_id: 'home-hero',
      promotion_name: 'New in',
      creative_name: 'Home hero',
    });
    expect(POPUP_PROMOTION).toStrictEqual({
      promotion_id: 'welcome-offer',
      promotion_name: 'Welcome offer',
      creative_name: 'Lead popup',
    });
  });
});

describe('parsePromotion', () => {
  it('reads what a page carries about a promotion', () => {
    expect(parsePromotion(JSON.stringify(HERO_PROMOTION))).toStrictEqual(HERO_PROMOTION);
    expect(parsePromotion(JSON.stringify(POPUP_PROMOTION))).toStrictEqual(POPUP_PROMOTION);
  });

  it('keeps only the three fields, so nothing else a page carries is announced', () => {
    const raw = JSON.stringify({ ...HERO_PROMOTION, extra: 'x', source: 'auto' });
    expect(parsePromotion(raw)).toStrictEqual(HERO_PROMOTION);
  });

  it('gives nothing for data that is missing, damaged or incomplete', () => {
    const bad = [
      undefined,
      '',
      'not json',
      'null',
      '[]',
      '{}',
      JSON.stringify({ promotion_id: 'a', promotion_name: 'b' }),
      JSON.stringify({ ...HERO_PROMOTION, promotion_id: 5 }),
      JSON.stringify({ ...HERO_PROMOTION, creative_name: '' }),
    ];
    for (const raw of bad) expect(parsePromotion(raw), String(raw)).toBeUndefined();
  });
});
