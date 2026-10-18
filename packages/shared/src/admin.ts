import { z } from 'zod';
import { clothingCategorySchema, occasionSchema, styleSchema } from './catalog';
import { planSchema, usageMeterSchema } from './plans';
import { subscriptionStatusSchema } from './subscriptions';

/**
 * Internal admin (development / operations) read models. Minimal on purpose
 * (spec §29): users, subscriptions, closet items, outfits, AI usage, basic
 * metrics. Only what support needs: no photos of people, no passwords, no
 * tokens, no profile details beyond the first name.
 */

export const ADMIN_PAGE_SIZE = 25;

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  plan: planSchema.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(ADMIN_PAGE_SIZE),
});
export type AdminUsersQuery = z.input<typeof adminUsersQuerySchema>;

export const adminUserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  plan: planSchema,
  onboarded: z.boolean(),
  items: z.number().int(),
  outfits: z.number().int(),
  createdAt: z.string(),
});
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminUsersPageSchema = z.object({
  items: z.array(adminUserRowSchema),
  nextCursor: z.string().nullable(),
});
export type AdminUsersPage = z.infer<typeof adminUsersPageSchema>;

export const adminUserDetailSchema = adminUserRowSchema.extend({
  city: z.string().nullable(),
  timezone: z.string(),
  locale: z.string(),
  analyticsEnabled: z.boolean(),
  subscription: z.object({
    status: subscriptionStatusSchema,
    provider: z.string(),
    currentPeriodEnd: z.string().nullable(),
    cancelAtPeriodEnd: z.boolean(),
  }),
  usage: z.array(usageMeterSchema),
  counts: z.object({
    items: z.number().int(),
    archivedItems: z.number().int(),
    outfits: z.number().int(),
    savedOutfits: z.number().int(),
    wears: z.number().int(),
    loves: z.number().int(),
    dislikes: z.number().int(),
    plannedDays: z.number().int(),
  }),
  recentItems: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: clothingCategorySchema,
      color: z.string(),
      thumbnailUrl: z.string(),
      createdAt: z.string(),
    }),
  ),
  recentOutfits: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      occasion: occasionSchema,
      style: styleSchema,
      pieces: z.number().int(),
      isSaved: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminSubscriptionsQuerySchema = z.object({
  status: z.enum(['active', 'canceling', 'all']).default('all'),
});

export const adminSubscriptionRowSchema = z.object({
  userId: z.string(),
  email: z.string(),
  plan: planSchema,
  status: subscriptionStatusSchema,
  provider: z.string(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  monthlyPriceXof: z.number().int(),
});
export const adminSubscriptionsSchema = z.object({
  items: z.array(adminSubscriptionRowSchema),
  /** Monthly recurring revenue of active, non-canceling paid plans, in FCFA. */
  mrrXof: z.number().int(),
});
export type AdminSubscriptions = z.infer<typeof adminSubscriptionsSchema>;
