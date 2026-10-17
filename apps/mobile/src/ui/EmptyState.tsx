import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from './Button';
import { Text } from './Text';
import { colors, colorsAlpha, spacing } from './theme';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.container} testID={testID}>
      <View style={styles.halo}>
        <View style={styles.iconWrap}>
          <Icon size={28} color={colors.accent} strokeWidth={1.75} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text variant="title3" align="center">
          {title}
        </Text>
        {body && (
          <Text variant="body" color="secondary" align="center">
            {body}
          </Text>
        )}
      </View>
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} size="md" />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  halo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing.sm, maxWidth: 320 },
});
