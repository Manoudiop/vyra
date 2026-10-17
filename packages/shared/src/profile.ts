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
  burgundy: '#7A2E3A',
  orange: '#D9782D',
  purple: '#6B4C8A',
  silver: '#B8BCC2',
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

/** sRGB → CIELAB (D65), the color space where Euclidean distance matches perception. */
function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const fn = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [fn(x), fn(y), fn(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const PALETTE_LAB = STYLE_COLOR_NAMES.map((name) => ({
  name,
  lab: rgbToLab(hexToRgb(STYLE_COLORS[name])!),
}));

/**
 * Closest vocabulary color to a hex value (CIE76 ΔE in Lab space), used to
 * turn a measured photo color into a palette color the engine understands.
 */
export function nearestStyleColor(hex: string): StyleColor | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [l, a, b] = rgbToLab(rgb);
  let best: StyleColor | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of PALETTE_LAB) {
    const [l2, a2, b2] = candidate.lab;
    const distance = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate.name;
    }
  }
  return best;
}
