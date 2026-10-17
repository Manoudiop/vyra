import { z } from 'zod';

export const CLOTHING_CATEGORIES = [
  'TOPS',
  'BOTTOMS',
  'SHOES',
  'OUTERWEAR',
  'ACCESSORIES',
  'TRADITIONAL',
  'OTHER',
] as const;
export const clothingCategorySchema = z.enum(CLOTHING_CATEGORIES);
export type ClothingCategory = z.infer<typeof clothingCategorySchema>;

export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER', 'ALL_SEASON'] as const;
export const seasonSchema = z.enum(SEASONS);
export type Season = z.infer<typeof seasonSchema>;

/** Style vocabulary shared by onboarding, closet items and the stylist. */
export const STYLES = [
  'CASUAL',
  'SMART_CASUAL',
  'ELEGANT',
  'STREETWEAR',
  'FORMAL',
  'SPORT',
  'TRADITIONAL',
] as const;
export const styleSchema = z.enum(STYLES);
export type Style = z.infer<typeof styleSchema>;

export const OCCASIONS = [
  'WORK',
  'DATE',
  'DINNER',
  'PARTY',
  'WEDDING',
  'TRAVEL',
  'CASUAL',
  'WORKOUT',
  'TRADITIONAL',
  'SURPRISE',
] as const;
export const occasionSchema = z.enum(OCCASIONS);
export type Occasion = z.infer<typeof occasionSchema>;

export const GENDER_PREFERENCES = ['WOMEN', 'MEN', 'UNISEX'] as const;
export const genderPreferenceSchema = z.enum(GENDER_PREFERENCES);
export type GenderPreference = z.infer<typeof genderPreferenceSchema>;
