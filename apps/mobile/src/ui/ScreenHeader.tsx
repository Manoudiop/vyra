import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from './Text';
import { spacing } from './theme';

export interface ScreenHeaderProps {
  title: string;
  overline?: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Large editorial page title used at the top of every tab. */
export function ScreenHeader({ title, overline, subtitle, right }: ScreenHeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.container}>
      <View style={styles.copy}>
        {overline && (
          <Text variant="overline" color="secondary">
            {overline}
          </Text>
        )}
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="body" color="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  copy: { flex: 1, gap: spacing.xs },
});
