import { type ColorToken } from '@vyra/config/tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type TextVariant, typography } from './theme';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export function Text({
  variant = 'body',
  color = 'primary',
  align,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
