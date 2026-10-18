import { z } from 'zod';
import { clothingCategorySchema, occasionSchema, styleSchema } from './catalog';
import { dislikeReasonSchema } from './outfits';
import { planSchema } from './plans';
import { paidPlanSchema } from './subscriptions';
import { weatherConditionSchema } from './weather';

/**
 * The product events (spec §30) and exactly what each may carry.
 *
 * Privacy by construction: every schema is strict and only holds enums,
 * booleans and small counts — never a name, email, free text, photo, place
 * or id of a garment. Events are tied to the account (so they disappear from
 * the user's history if the account is deleted) and only recorded when the
 * user has not turned analytics off.
 */
export const ANALYTICS_EVENTS = {
  signup: z.object({}).strict(),
  onboarding_completed: z
    .object({
      styles: z.number().int().min(0).max(10),
      colors: z.number().int().min(0).max(20),
      occasions: z.number().int().min(0).max(10),
    })
    .strict(),
  item_added: z
    .object({
      category: clothingCategorySchema,
      /** The form was pre-filled by the AI analysis. */
      aiPrefilled: z.boolean(),
      /** How many AI suggestions the user changed before saving. */
      corrections: z.number().int().min(0).max(10),
    })
    .strict(),
  outfit_generated: z
    .object({
      occasion: occasionSchema,
      style: styleSchema,
      candidateCount: z.number().int().min(0).max(100),
      /** Generated for a later calendar day. */
      planned: z.boolean(),
      weather: weatherConditionSchema.nullable(),
      provider: z.string().max(40),
    })
    .strict(),
  outfit_saved: z.object({ occasion: occasionSchema }).strict(),
  outfit_worn: z.object({ occasion: occasionSchema }).strict(),
  outfit_liked: z.object({ occasion: occasionSchema }).strict(),
  outfit_disliked: z
    .object({ occasion: occasionSchema, reason: dislikeReasonSchema.nullable() })
    .strict(),
  paywall_viewed: z
    .object({
      reason: z
        .enum(['generations', 'analyses', 'calendar', 'history', 'style', 'closet'])
        .nullable(),
      currentPlan: planSchema,
    })
    .strict(),
  subscription_started: z
    .object({ plan: paidPlanSchema, previousPlan: planSchema, provider: z.string().max(40) })
    .strict(),
  subscription_cancelled: z.object({ plan: paidPlanSchema }).strict(),
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProperties<E extends AnalyticsEventName> = z.infer<
  (typeof ANALYTICS_EVENTS)[E]
>;
export const ANALYTICS_EVENT_NAMES = Object.keys(ANALYTICS_EVENTS) as AnalyticsEventName[];

/**
 * The only event the app reports itself: what the server cannot see. The
 * server adds `currentPlan`; everything else is recorded server-side, where
 * it actually happens.
 */
export const clientAnalyticsEventSchema = z.object({
  name: z.literal('paywall_viewed'),
  properties: ANALYTICS_EVENTS.paywall_viewed.omit({ currentPlan: true }),
});
export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;

/** Basic product metrics for the admin. */
export const adminMetricsSchema = z.object({
  generatedAt: z.string(),
  users: z.object({
    total: z.number().int(),
    newLast7Days: z.number().int(),
    activeLast7Days: z.number().int(),
    onboarded: z.number().int(),
  }),
  plans: z.record(planSchema, z.number().int()),
  /** What lives in the app: closet pieces (not archived), outfits, wears. */
  content: z.object({
    clothingItems: z.number().int(),
    outfits: z.number().int(),
    wears: z.number().int(),
  }),
  /** Metered AI calls counted over the last 30 days. */
  aiUsage: z.object({
    OUTFIT_GENERATION: z.number().int(),
    CLOTHING_ANALYSIS: z.number().int(),
  }),
  /** Event counts over the last 30 days. */
  events: z.record(z.string(), z.number().int()),
  rates: z.object({
    /** subscription_started / paywall_viewed over 30 days (null without views). */
    paywallConversion: z.number().nullable(),
    /** outfit_liked / (liked + disliked) over 30 days. */
    outfitApproval: z.number().nullable(),
  }),
});
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;
