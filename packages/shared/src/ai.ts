import { z } from 'zod';
import { clothingCategorySchema, seasonSchema, styleSchema } from './catalog';
import { styleColorSchema } from './profile';

export const analyzeClothingRequestSchema = z.object({
  /** Key returned by POST /api/storage/images; must belong to the caller. */
  imageKey: z.string().min(1).max(300),
});
export type AnalyzeClothingRequest = z.infer<typeof analyzeClothingRequestSchema>;

const confidenceSchema = z.number().min(0).max(1);

/**
 * What the AI could identify on a clothing photo. Every field is a suggestion:
 * the user always reviews and edits it before saving.
 */
export const clothingAnalysisSchema = z.object({
  name: z.string(),
  category: clothingCategorySchema,
  subcategory: z.string().nullable(),
  color: styleColorSchema,
  colorHex: z.string().regex(/^#[0-9A-F]{6}$/),
  style: styleSchema.nullable(),
  season: seasonSchema,
  /** Per-field confidence in [0, 1]; the app highlights low-confidence fields. */
  confidence: z.object({
    category: confidenceSchema,
    color: confidenceSchema,
    style: confidenceSchema,
    season: confidenceSchema,
  }),
});
export type ClothingAnalysis = z.infer<typeof clothingAnalysisSchema>;

export const analyzeClothingResponseSchema = z.object({
  analysis: clothingAnalysisSchema,
  /** Which AIProvider produced the result ("mock" in development). */
  provider: z.string(),
});
export type AnalyzeClothingResponse = z.infer<typeof analyzeClothingResponseSchema>;

/** Below this, the app asks the user to double-check the field. */
export const LOW_CONFIDENCE = 0.6;
