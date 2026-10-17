import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii } from '@/ui';

export function ProgressBar({ progress }: { progress: number }) {
  const value = useSharedValue(progress);

  useEffect(() => {
    value.set(withTiming(progress, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [progress, value]);

  const fill = useAnimatedStyle(() => ({ width: `${Math.round(value.get() * 100)}%` }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
});
