import { z } from 'zod';
import { genderPreferenceSchema, occasionSchema, styleSchema } from './catalog';

/**
 * Color vocabulary shared by onboarding, closet items and the outfit engine.
 * Keys are lowercase English names (as stored in ClothingItem.color); hex is for display.
 */
export const STYLE_COLORS = {
  black: '#111111',
  white: '#F7F6F2',
  cream: '#EFE6D6',
  beige: '#D8C7AA',
  camel: '#B98B5E',
  brown: '#6B4423',
  grey: '#9A9690',
  navy: '#1F2A44',
  blue: '#3E64A8',
  green: '#3E7C65',
  olive: '#6B704A',
  red: '#A3302B',
  terracotta: '#B5573B',
  pink: '#E3A6A8',
  yellow: '#E2B93B',
  gold: '#C9A45C',
} as const;

export type StyleColor = keyof typeof STYLE_COLORS;
export const STYLE_COLOR_NAMES = Object.keys(STYLE_COLORS) as [StyleColor, ...StyleColor[]];
export const styleColorSchema = z.enum(STYLE_COLOR_NAMES);

/** Occasions offered at onboarding ("Surprise me" is a stylist action, not a preference). */
export const ONBOARDING_OCCASIONS = [
  'WORK',
  'DATE',
  'DINNER',
  'PARTY',
  'WEDDING',
  'TRAVEL',
  'CASUAL',
  'WORKOUT',
  'TRADITIONAL',
] as const;

export const PREFERENCE_LIMITS = {
  styles: { min: 1, max: 4 },
  colors: { min: 1, max: 6 },
  occasions: { min: 1, max: 5 },
} as const;

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .max(64)
  .refine(isValidTimeZone, { message: 'Unknown IANA time zone' });

const uniqueArray = <T extends z.ZodTypeAny>(item: T, min: number, max: number) =>
  z
    .array(item)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, { message: 'Duplicate values' });

const firstNameSchema = z.string().trim().min(1).max(60);
const citySchema = z.string().trim().min(1).max(80);
const countryCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((value) => value.toUpperCase());

export const preferredStylesSchema = uniqueArray(
  styleSchema,
  PREFERENCE_LIMITS.styles.min,
  PREFERENCE_LIMITS.styles.max,
);
export const preferredColorsSchema = uniqueArray(
  styleColorSchema,
  PREFERENCE_LIMITS.colors.min,
  PREFERENCE_LIMITS.colors.max,
);
export const preferredOccasionsSchema = uniqueArray(
  occasionSchema.exclude(['SURPRISE']),
  PREFERENCE_LIMITS.occasions.min,
  PREFERENCE_LIMITS.occasions.max,
);

/** Everything collected by the 8-step onboarding, submitted at the last step. */
export const completeOnboardingSchema = z.object({
  firstName: firstNameSchema,
  genderPreference: genderPreferenceSchema,
  preferredStyles: preferredStylesSchema,
  preferredColors: preferredColorsSchema,
  preferredOccasions: preferredOccasionsSchema,
  city: citySchema,
  countryCode: countryCodeSchema.optional(),
  timezone: timezoneSchema.optional(),
});
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

/** Later edits from the profile screen: any subset of the onboarding fields. */
export const updateProfileSchema = completeOnboardingSchema
  .extend({
    lastName: z.string().trim().max(60).nullable(),
    notificationsEnabled: z.boolean(),
    countryCode: countryCodeSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSchema = z.object({
  firstName: z.string(),
  lastName: z.string().nullable(),
  genderPreference: genderPreferenceSchema.nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  timezone: z.string(),
  locale: z.string(),
  notificationsEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
  preferredStyles: z.array(styleSchema),
  preferredColors: z.array(z.string()),
  preferredOccasions: z.array(occasionSchema),
});
export type Profile = z.infer<typeof profileSchema>;

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Closest vocabulary color to a hex value, using a perceptually weighted RGB
 * distance ("redmean"), good enough to pre-select a color from a photo.
 */
export function nearestStyleColor(hex: string): StyleColor | null {
  const target = hexToRgb(hex);
  if (!target) return null;
  let best: StyleColor | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const name of STYLE_COLOR_NAMES) {
    const [r, g, b] = hexToRgb(STYLE_COLORS[name])!;
    const meanRed = (target[0] + r) / 2;
    const dr = target[0] - r;
    const dg = target[1] - g;
    const db = target[2] - b;
    const distance =
      (2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}
