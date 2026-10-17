import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, radii, shadows, spacing } from './theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
  testID,
}: CardProps) {
  const cardStyle = [styles.card, padded && styles.padded, style];
  if (!onPress) {
    return (
      <View style={cardStyle} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      pressedScale={0.98}
      style={cardStyle}
      testID={testID}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.card,
  },
  padded: { padding: spacing.lg },
});
