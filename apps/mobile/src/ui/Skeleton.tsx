import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii } from './theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Placeholder block with a slow, calm pulse while content loads. */
export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.set(
      withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { width, height, borderRadius: radius }, animated, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.muted },
});
