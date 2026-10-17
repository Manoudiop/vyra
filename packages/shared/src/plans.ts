import { z } from 'zod';

export const PLANS = ['FREE', 'PRO', 'PREMIUM'] as const;
export const planSchema = z.enum(PLANS);
export type Plan = z.infer<typeof planSchema>;

export const USAGE_METRICS = ['OUTFIT_GENERATION', 'CLOTHING_ANALYSIS'] as const;
export const usageMetricSchema = z.enum(USAGE_METRICS);
export type UsageMetric = z.infer<typeof usageMetricSchema>;

export type UsagePeriod = 'DAY' | 'WEEK' | 'MONTH';

export interface MeteredLimit {
  /** `null` means unlimited. */
  limit: number | null;
  period: UsagePeriod;
}

export const PLAN_FEATURES = [
  'WEATHER',
  'CALENDAR_FULL',
  'WEAR_HISTORY_FULL',
  'STYLE_ANALYSIS',
  'EVENT_STYLING',
  'SHOPPING_RECOMMENDATIONS',
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export interface PlanDefinition {
  plan: Plan;
  /** Monthly price in FCFA (XOF). */
  monthlyPriceXof: number;
  /** Maximum active clothing items; `null` means unlimited. */
  maxClothingItems: number | null;
  metered: Record<UsageMetric, MeteredLimit>;
  features: readonly PlanFeature[];
}

/**
 * Single source of truth for plan limits (decisions recorded in
 * docs/IMPLEMENTATION_PLAN.md §4 and §7). FREE keeps current weather and the
 * current calendar week; full planning and history are PRO.
 */
export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    plan: 'FREE',
    monthlyPriceXof: 0,
    maxClothingItems: 30,
    metered: {
      OUTFIT_GENERATION: { limit: 3, period: 'WEEK' },
      CLOTHING_ANALYSIS: { limit: 30, period: 'MONTH' },
    },
    features: ['WEATHER'],
  },
  PRO: {
    plan: 'PRO',
    monthlyPriceXof: 2500,
    maxClothingItems: null,
    metered: {
      OUTFIT_GENERATION: { limit: 5, period: 'DAY' },
      // "Unlimited" analysis, with a fair-use ceiling against abuse.
      CLOTHING_ANALYSIS: { limit: 100, period: 'DAY' },
    },
    features: ['WEATHER', 'CALENDAR_FULL', 'WEAR_HISTORY_FULL'],
  },
  PREMIUM: {
    plan: 'PREMIUM',
    monthlyPriceXof: 5000,
    maxClothingItems: null,
    metered: {
      OUTFIT_GENERATION: { limit: 20, period: 'DAY' },
      CLOTHING_ANALYSIS: { limit: 100, period: 'DAY' },
    },
    features: [
      'WEATHER',
      'CALENDAR_FULL',
      'WEAR_HISTORY_FULL',
      'STYLE_ANALYSIS',
      'EVENT_STYLING',
      'SHOPPING_RECOMMENDATIONS',
    ],
  },
};

export function getMeteredLimit(plan: Plan, metric: UsageMetric): MeteredLimit {
  return PLAN_DEFINITIONS[plan].metered[metric];
}

export function planHasFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_DEFINITIONS[plan].features.includes(feature);
}

/** Cheapest plan above `plan` with a higher limit for `metric`, or `null`. */
export function suggestUpgrade(plan: Plan, metric: UsageMetric): Plan | null {
  const current = getMeteredLimit(plan, metric).limit;
  if (current === null) return null;
  const higher = PLANS.slice(PLANS.indexOf(plan) + 1).find((candidate) => {
    const next = getMeteredLimit(candidate, metric).limit;
    return next === null || next > current;
  });
  return higher ?? null;
}

/** Start of the usage period containing `at`, in UTC. Weeks start on Monday. */
export function getPeriodStart(period: UsagePeriod, at: Date = new Date()): Date {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  if (period === 'WEEK') {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  } else if (period === 'MONTH') {
    start.setUTCDate(1);
  }
  return start;
}

/** Start of the next period, i.e. when the counter resets. */
export function getPeriodEnd(period: UsagePeriod, at: Date = new Date()): Date {
  const end = getPeriodStart(period, at);
  if (period === 'DAY') end.setUTCDate(end.getUTCDate() + 1);
  else if (period === 'WEEK') end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}
