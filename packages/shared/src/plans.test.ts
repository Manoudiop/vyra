import { describe, expect, it } from 'vitest';
import {
  PLAN_DEFINITIONS,
  getMeteredLimit,
  getPeriodEnd,
  getPeriodStart,
  planHasFeature,
  suggestUpgrade,
} from './plans';

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

describe('usage periods (UTC)', () => {
  // Wednesday 2026-10-14 15:30 UTC
  const at = new Date('2026-10-14T15:30:00Z');

  it('computes day boundaries', () => {
    expect(getPeriodStart('DAY', at).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(getPeriodEnd('DAY', at).toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('starts weeks on Monday', () => {
    expect(getPeriodStart('WEEK', at).toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(getPeriodEnd('WEEK', at).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    // Sunday belongs to the week that started the previous Monday.
    expect(getPeriodStart('WEEK', new Date('2026-10-18T23:59:00Z')).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    );
  });

  it('computes month boundaries', () => {
    expect(getPeriodStart('MONTH', at).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(getPeriodEnd('MONTH', at).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});
