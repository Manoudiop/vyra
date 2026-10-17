import { type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { colors, radii, spacing } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: keyof typeof colors; border?: string }> = {
  primary: { bg: colors.primary, fg: 'onPrimary' },
  accent: { bg: colors.accent, fg: 'onPrimary' },
  secondary: { bg: colors.surface, fg: 'primary', border: colors.border },
  ghost: { bg: 'transparent', fg: 'primary' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (variant === 'primary' || variant === 'accent') haptics.impact();
        else haptics.selection();
        onPress?.();
      }}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: palette.bg },
        palette.border && {
          borderColor: palette.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
        },
        fullWidth && styles.fullWidth,
        inactive && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[palette.fg]} />
      ) : (
        <View style={styles.content}>
          {Icon && <Icon size={18} color={colors[palette.fg]} strokeWidth={2} />}
          <Text variant="bodyStrong" color={palette.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  lg: { minHeight: 56 },
  md: { minHeight: 44, paddingHorizontal: spacing.lg },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.4 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
