import { z } from 'zod';
import { occasionSchema, styleSchema } from './catalog';
import { clothingItemSchema } from './closet';
import { styleColorSchema } from './profile';

/** Quick constraints offered by the stylist screen ("avoid jeans", "no heels"…). */
export const AVOIDABLE_KINDS = ['jeans', 'heels', 'sneakers', 'shorts', 'skirt', 'dress'] as const;
export const avoidableKindSchema = z.enum(AVOIDABLE_KINDS);
export type AvoidableKind = z.infer<typeof avoidableKindSchema>;

export const outfitConstraintsSchema = z
  .object({
    avoidColors: z.array(styleColorSchema).max(6).default([]),
    avoidKinds: z.array(avoidableKindSchema).max(6).default([]),
    /** "Use this item": every candidate must include it. */
    requiredItemId: z.uuid().optional(),
  })
  .default({ avoidColors: [], avoidKinds: [] });
export type OutfitConstraints = z.infer<typeof outfitConstraintsSchema>;

export const generateOutfitRequestSchema = z.object({
  occasion: occasionSchema,
  style: styleSchema,
  constraints: outfitConstraintsSchema,
  /** "Try another": outfits whose exact combinations must not be proposed again. */
  excludeOutfitIds: z.array(z.uuid()).max(20).default([]),
});
export type GenerateOutfitRequest = z.input<typeof generateOutfitRequestSchema>;

/** "Love it" / "Not for me". */
export const FEEDBACK_RATINGS = ['LOVE', 'DISLIKE'] as const;
export const feedbackRatingSchema = z.enum(FEEDBACK_RATINGS);
export type FeedbackRating = z.infer<typeof feedbackRatingSchema>;

/** Optional one-tap reason after "Not for me", kept for style learning (phase 12). */
export const DISLIKE_REASONS = ['NOT_MY_STYLE', 'COLORS', 'OCCASION', 'ONE_PIECE'] as const;
export const dislikeReasonSchema = z.enum(DISLIKE_REASONS);
export type DislikeReason = z.infer<typeof dislikeReasonSchema>;

export const outfitFeedbackInputSchema = z
  .object({
    rating: feedbackRatingSchema,
    reason: dislikeReasonSchema.optional(),
  })
  .refine((input) => input.rating === 'DISLIKE' || !input.reason, {
    message: 'A reason only applies to "Not for me"',
    path: ['reason'],
  });
export type OutfitFeedbackInput = z.infer<typeof outfitFeedbackInputSchema>;

export const updateOutfitSchema = z.object({ isSaved: z.boolean() });
export type UpdateOutfitInput = z.infer<typeof updateOutfitSchema>;

export const OUTFITS_PAGE_SIZE = 20;
export const outfitsQuerySchema = z.object({
  saved: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(OUTFITS_PAGE_SIZE),
});
export type OutfitsQuery = z.input<typeof outfitsQuerySchema>;

export const outfitSchema = z.object({
  id: z.string(),
  name: z.string(),
  occasion: occasionSchema,
  style: styleSchema,
  reason: z.string(),
  score: z.number().nullable(),
  isSaved: z.boolean(),
  constraints: outfitConstraintsSchema.nullable(),
  /** Pieces in display order (outerwear, top or one-piece, bottom, shoes, accessories). */
  items: z.array(clothingItemSchema),
  /** The user's rating of this look, if any. */
  feedback: z
    .object({ rating: feedbackRatingSchema, reason: dislikeReasonSchema.nullable() })
    .nullable(),
  /** Worn on the current day in the user's timezone. */
  wornToday: z.boolean(),
  lastWornAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Outfit = z.infer<typeof outfitSchema>;

export const outfitPageSchema = z.object({
  items: z.array(outfitSchema),
  nextCursor: z.string().nullable(),
});
export type OutfitPage = z.infer<typeof outfitPageSchema>;

export const generateOutfitResponseSchema = z.object({
  outfit: outfitSchema,
  provider: z.string(),
  /** How many valid combinations the engine found (shown as "1 of N" for variety). */
  candidateCount: z.number().int().nonnegative(),
});
export type GenerateOutfitResponse = z.infer<typeof generateOutfitResponseSchema>;

/** Closet categories needed to build an outfit, returned when generation is impossible. */
export const MISSING_PIECES = ['TOP', 'BOTTOM', 'SHOES'] as const;
export type MissingPiece = (typeof MISSING_PIECES)[number];

/** Default style the stylist pre-selects for each occasion. */
export const OCCASION_DEFAULT_STYLE = {
  WORK: 'SMART_CASUAL',
  DATE: 'ELEGANT',
  DINNER: 'ELEGANT',
  PARTY: 'ELEGANT',
  WEDDING: 'TRADITIONAL',
  TRAVEL: 'CASUAL',
  CASUAL: 'CASUAL',
  WORKOUT: 'SPORT',
  TRADITIONAL: 'TRADITIONAL',
  SURPRISE: 'SMART_CASUAL',
} as const satisfies Record<z.infer<typeof occasionSchema>, z.infer<typeof styleSchema>>;
