import { z } from 'zod';
import { CLOTHING_CATEGORIES, clothingCategorySchema, seasonSchema, styleSchema } from './catalog';
import { styleColorSchema } from './profile';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());

const itemFields = {
  name: z.string().trim().min(1).max(80),
  category: clothingCategorySchema,
  subcategory: z.string().trim().min(1).max(60).nullable(),
  color: styleColorSchema,
  colorHex: hexColorSchema.nullable(),
  style: styleSchema.nullable(),
  season: seasonSchema,
  isFavorite: z.boolean(),
};

/**
 * New item. `imageKey`/`thumbnailKey` come from the upload endpoint (phase 7)
 * and must live under the caller's own storage namespace (checked by the API).
 */
export const createClothingItemSchema = z.object({
  ...itemFields,
  subcategory: itemFields.subcategory.optional(),
  colorHex: itemFields.colorHex.optional(),
  style: itemFields.style.optional(),
  season: itemFields.season.default('ALL_SEASON'),
  isFavorite: itemFields.isFavorite.default(false),
  imageKey: z.string().min(1).max(300),
  thumbnailKey: z.string().min(1).max(300).optional(),
  /** Raw AI analysis kept for learning/debugging; never trusted for display. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateClothingItemInput = z.input<typeof createClothingItemSchema>;

export const updateClothingItemSchema = z
  .object(itemFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateClothingItemInput = z.infer<typeof updateClothingItemSchema>;

export const CLOSET_PAGE_SIZE = 24;

export const closetQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  category: clothingCategorySchema.optional(),
  favorite: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(CLOSET_PAGE_SIZE),
});
export type ClosetQuery = z.input<typeof closetQuerySchema>;

export const clothingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: clothingCategorySchema,
  subcategory: z.string().nullable(),
  color: z.string(),
  colorHex: z.string().nullable(),
  style: styleSchema.nullable(),
  season: seasonSchema,
  isFavorite: z.boolean(),
  /** Short-lived signed URLs; refetch the item rather than caching them for long. */
  imageUrl: z.string(),
  thumbnailUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClothingItem = z.infer<typeof clothingItemSchema>;

export const clothingItemDetailSchema = clothingItemSchema.extend({
  stats: z.object({
    /** Outfits (generated or saved) that include this item. */
    outfitCount: z.number().int().nonnegative(),
    wearCount: z.number().int().nonnegative(),
    lastWornAt: z.string().nullable(),
  }),
});
export type ClothingItemDetail = z.infer<typeof clothingItemDetailSchema>;

export const closetPageSchema = z.object({
  items: z.array(clothingItemSchema),
  nextCursor: z.string().nullable(),
});
export type ClosetPage = z.infer<typeof closetPageSchema>;

export const closetSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  byCategory: z.record(clothingCategorySchema, z.number().int().nonnegative()),
  /** Max active items on the current plan; null = unlimited. */
  limit: z.number().int().nullable(),
});
export type ClosetSummary = z.infer<typeof closetSummarySchema>;

export const emptyCategoryCounts = () =>
  Object.fromEntries(CLOTHING_CATEGORIES.map((category) => [category, 0])) as Record<
    (typeof CLOTHING_CATEGORIES)[number],
    number
  >;
