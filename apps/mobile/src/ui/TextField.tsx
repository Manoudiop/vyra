import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { colors, fontFamily, fontSize, hitSlop, radii, spacing } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  /** Renders a show/hide toggle and starts hidden. */
  password?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, password = false, onFocus, onBlur, testID, ...inputProps },
  ref,
) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <Text variant="caption" color="secondary" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.field, { borderColor }]}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.secondary}
          selectionColor={colors.accent}
          secureTextEntry={hidden}
          autoCorrect={false}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? t('auth.fields.showPassword') : t('auth.fields.hidePassword')
            }
            hitSlop={hitSlop}
            onPress={() => setHidden((value) => !value)}
          >
            {hidden ? (
              <Eye size={20} color={colors.secondary} />
            ) : (
              <EyeOff size={20} color={colors.secondary} />
            )}
          </Pressable>
        )}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs + 2 },
  label: { marginLeft: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.callout,
    color: colors.primary,
    paddingVertical: spacing.md,
  },
});
