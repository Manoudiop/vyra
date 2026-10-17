import { fontFamily, fontSize } from '@vyra/config/tokens';
import { type TextStyle } from 'react-native';

export { colors, fontFamily, fontSize, motion, radii, shadows, spacing } from '@vyra/config/tokens';

export type TextVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'footnote'
  | 'caption'
  | 'overline';

/** Type scale. Line heights are ~1.25 for titles and ~1.45 for running text. */
export const typography: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  title1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title1,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  title2: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.title2,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  title3: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.title3,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, lineHeight: 22 },
  callout: { fontFamily: fontFamily.medium, fontSize: fontSize.callout, lineHeight: 22 },
  footnote: { fontFamily: fontFamily.regular, fontSize: fontSize.footnote, lineHeight: 18 },
  caption: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, lineHeight: 16 },
  overline: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export const colorsAlpha = {
  accentSoft: 'rgba(183, 155, 114, 0.14)',
  primarySoft: 'rgba(17, 17, 17, 0.06)',
  successSoft: 'rgba(62, 124, 101, 0.12)',
  dangerSoft: 'rgba(164, 71, 59, 0.10)',
} as const;
