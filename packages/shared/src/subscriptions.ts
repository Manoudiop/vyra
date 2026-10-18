import { z } from 'zod';
import { planSchema, PLAN_FEATURES, usageMetricSchema } from './plans';

export const SUBSCRIPTION_STATUSES = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
] as const;
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

/** Paid plans a user can subscribe to. */
export const paidPlanSchema = z.enum(['PRO', 'PREMIUM']);
export type PaidPlan = z.infer<typeof paidPlanSchema>;

/** One plan as the paywall shows it, built from PLAN_DEFINITIONS. */
export const planOfferSchema = z.object({
  plan: planSchema,
  monthlyPriceXof: z.number().int().nonnegative(),
  maxClothingItems: z.number().int().nullable(),
  metered: z.array(
    z.object({
      metric: usageMetricSchema,
      limit: z.number().int().nullable(),
      period: z.enum(['DAY', 'WEEK', 'MONTH']),
    }),
  ),
  features: z.array(z.enum(PLAN_FEATURES)),
});
export type PlanOffer = z.infer<typeof planOfferSchema>;

export const subscriptionSchema = z.object({
  /** The plan in effect right now (FREE when nothing paid is active). */
  plan: planSchema,
  status: subscriptionStatusSchema,
  provider: z.string(),
  /** Paid plans: the current billing month. */
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  /** Canceled but still active until `currentPeriodEnd`. */
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const checkoutRequestSchema = z.object({ plan: paidPlanSchema });
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  /**
   * COMPLETED: active now (mock). PENDING: the user must finish paying at
   * `paymentUrl` (real providers later); the app polls the subscription.
   */
  status: z.enum(['COMPLETED', 'PENDING']),
  paymentUrl: z.string().nullable(),
  subscription: subscriptionSchema,
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

/** "2 500 FCFA" — French grouping, as prices are shown in West Africa. */
export function formatXof(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}
