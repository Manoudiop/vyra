import { describe, expect, it } from 'vitest';
import { PLAN_DEFINITIONS, getMeteredLimit, planHasFeature, suggestUpgrade } from './plans';

describe('plan definitions', () => {
  it('matches the validated MVP limits', () => {
    expect(PLAN_DEFINITIONS.FREE.maxClothingItems).toBe(30);
    expect(getMeteredLimit('FREE', 'OUTFIT_GENERATION')).toEqual({ limit: 3, period: 'WEEK' });
    expect(getMeteredLimit('FREE', 'CLOTHING_ANALYSIS')).toEqual({ limit: 30, period: 'MONTH' });
    expect(getMeteredLimit('PRO', 'OUTFIT_GENERATION')).toEqual({ limit: 5, period: 'DAY' });
    expect(getMeteredLimit('PREMIUM', 'OUTFIT_GENERATION')).toEqual({ limit: 20, period: 'DAY' });
    expect(PLAN_DEFINITIONS.PRO.monthlyPriceXof).toBe(2500);
    expect(PLAN_DEFINITIONS.PREMIUM.monthlyPriceXof).toBe(5000);
  });

  it('gates features by plan', () => {
    expect(planHasFeature('FREE', 'WEATHER')).toBe(true);
    expect(planHasFeature('FREE', 'CALENDAR_FULL')).toBe(false);
    expect(planHasFeature('PRO', 'CALENDAR_FULL')).toBe(true);
    expect(planHasFeature('PRO', 'STYLE_ANALYSIS')).toBe(false);
    expect(planHasFeature('PREMIUM', 'STYLE_ANALYSIS')).toBe(true);
  });

  it('suggests the next plan that lifts a limit', () => {
    expect(suggestUpgrade('FREE', 'OUTFIT_GENERATION')).toBe('PRO');
    expect(suggestUpgrade('PRO', 'OUTFIT_GENERATION')).toBe('PREMIUM');
    expect(suggestUpgrade('PREMIUM', 'OUTFIT_GENERATION')).toBeNull();
  });
});
