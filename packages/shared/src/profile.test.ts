import { describe, expect, it } from 'vitest';
import { completeOnboardingSchema, STYLE_COLOR_NAMES, updateProfileSchema } from './profile';

const valid = {
  firstName: ' Amina ',
  genderPreference: 'WOMEN',
  preferredStyles: ['ELEGANT', 'TRADITIONAL'],
  preferredColors: ['beige', 'gold'],
  preferredOccasions: ['WORK', 'WEDDING'],
  city: 'Dakar',
  countryCode: 'sn',
  timezone: 'Africa/Dakar',
};

describe('onboarding schema', () => {
  it('accepts a complete onboarding and normalizes values', () => {
    const parsed = completeOnboardingSchema.parse(valid);
    expect(parsed.firstName).toBe('Amina');
    expect(parsed.countryCode).toBe('SN');
  });

  it('enforces selection limits and uniqueness', () => {
    expect(completeOnboardingSchema.safeParse({ ...valid, preferredStyles: [] }).success).toBe(
      false,
    );
    expect(
      completeOnboardingSchema.safeParse({
        ...valid,
        preferredStyles: ['CASUAL', 'ELEGANT', 'FORMAL', 'SPORT', 'STREETWEAR'],
      }).success,
    ).toBe(false);
    expect(
      completeOnboardingSchema.safeParse({ ...valid, preferredColors: ['gold', 'gold'] }).success,
    ).toBe(false);
  });

  it('rejects unknown colors, "Surprise me" as a preference and bad time zones', () => {
    expect(
      completeOnboardingSchema.safeParse({ ...valid, preferredColors: ['plaid'] }).success,
    ).toBe(false);
    expect(
      completeOnboardingSchema.safeParse({ ...valid, preferredOccasions: ['SURPRISE'] }).success,
    ).toBe(false);
    expect(completeOnboardingSchema.safeParse({ ...valid, timezone: 'Mars/Olympus' }).success).toBe(
      false,
    );
  });

  it('exposes a stable color vocabulary', () => {
    expect(STYLE_COLOR_NAMES).toContain('terracotta');
    expect(STYLE_COLOR_NAMES.every((name) => name === name.toLowerCase())).toBe(true);
  });
});

describe('profile update schema', () => {
  it('accepts partial updates but not empty ones', () => {
    expect(updateProfileSchema.safeParse({ city: 'Abidjan' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ lastName: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});

describe('nearestStyleColor', () => {
  it('maps photo colors onto the shared vocabulary', async () => {
    const { nearestStyleColor } = await import('./profile');
    expect(nearestStyleColor('#B5573B')).toBe('terracotta');
    expect(nearestStyleColor('#0a0a0a')).toBe('black');
    expect(nearestStyleColor('#FAFAF7')).toBe('white');
    expect(nearestStyleColor('#22305a')).toBe('navy');
    expect(nearestStyleColor('#CAB18A')).toBe('beige'); // sand coat
    expect(nearestStyleColor('#262626')).toBe('black');
    expect(nearestStyleColor('#2F4A73')).toBe('navy'); // dark denim
    expect(nearestStyleColor('#7A2E3A')).toBe('burgundy');
    expect(nearestStyleColor('nope')).toBeNull();
  });
});
