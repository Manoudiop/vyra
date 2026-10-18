import { z } from 'zod';
import { occasionSchema, styleSchema } from './catalog';
import { clothingItemSchema } from './closet';

/** Below this many signals (loves, dislikes, wears, saves) the profile is still learning. */
export const LEARNING_MIN_SIGNALS = 3;

const weighted = <T extends z.ZodType>(key: T) =>
  z.object({ value: key, weight: z.number().min(-1).max(1) });

export const styleAnalysisSchema = z.object({
  summary: z.string(),
  dominantStyles: z.array(styleSchema),
  signatureColors: z.array(z.string()),
  suggestions: z.array(z.string()),
  createdAt: z.string(),
});
export type StyleAnalysisResult = z.infer<typeof styleAnalysisSchema>;

export const styleProfileSchema = z.object({
  /** What the user said (onboarding, profile edits). Never overwritten by learning. */
  declared: z.object({
    styles: z.array(styleSchema),
    colors: z.array(z.string()),
    occasions: z.array(occasionSchema),
  }),
  /** What VYRA learned from ratings, wears and saves; weights in [-1, 1]. */
  learned: z.object({
    colors: z.array(weighted(z.string())),
    avoidedColors: z.array(weighted(z.string())),
    styles: z.array(weighted(styleSchema)),
    avoidedStyles: z.array(weighted(styleSchema)),
    /** The style the user goes for, per occasion. */
    occasionStyles: z.array(
      z.object({ occasion: occasionSchema, style: styleSchema, weight: z.number() }),
    ),
    favoritePieces: z.array(clothingItemSchema),
    avoidedPieces: z.array(clothingItemSchema),
  }),
  signals: z.object({
    loves: z.number().int(),
    dislikes: z.number().int(),
    wears: z.number().int(),
    saves: z.number().int(),
  }),
  /** Enough signals for the learned part to mean something. */
  ready: z.boolean(),
  computedAt: z.string().nullable(),
  /** Last AI style analysis, if any (PREMIUM). */
  analysis: styleAnalysisSchema.nullable(),
  canAnalyze: z.boolean(),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;
