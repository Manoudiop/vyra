/**
 * VYRA design tokens — single source of truth for the mobile app and admin.
 * Minimal palette by design: neutrals, one warm accent, one success tone.
 */
export const colors = {
  background: '#F8F7F4',
  surface: '#FFFFFF',
  primary: '#111111',
  secondary: '#77736D',
  accent: '#B79B72',
  success: '#3E7C65',
  danger: '#A4473B',
  border: '#E8E5DF',
  muted: '#EFEDE8',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(17, 17, 17, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const fontSize = {
  caption: 12,
  footnote: 13,
  body: 15,
  callout: 16,
  title3: 20,
  title2: 24,
  title1: 30,
  display: 38,
} as const;

export const shadows = {
  card: {
    shadowColor: '#111111',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#111111',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const motion = {
  fast: 160,
  normal: 240,
  slow: 380,
} as const;

export const tokens = { colors, spacing, radii, fontFamily, fontSize, shadows, motion } as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
