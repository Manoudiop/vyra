import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, Text } from '@/ui';

const STEPS = ['stylist.step1', 'stylist.step2', 'stylist.step3', 'stylist.step4'] as const;

/**
 * Full-screen "the stylist is thinking" moment: a breathing orb and the steps
 * the engine actually goes through (closet, recent wears, colors, finish).
 */
export function GeneratingOverlay() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const breath = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    spin.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1));
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, STEPS.length - 1)),
      800,
    );
    return () => clearInterval(timer);
  }, [breath, spin]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + breath.get() * 0.35,
    transform: [{ scale: 1 + breath.get() * 0.18 }],
  }));
  const orb = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
      testID="generating-overlay"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={orb}>
          <LinearGradient
            colors={['#D8C29C', colors.accent, '#8F7653']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orb}
          >
            <Sparkles size={34} color={colors.onPrimary} strokeWidth={1.8} />
          </LinearGradient>
        </Animated.View>
      </View>
      <Animated.View key={step} entering={FadeIn.duration(300)} style={styles.copy}>
        <Text variant="title3" color="onPrimary" align="center">
          {t(STEPS[step]!)}
        </Text>
      </Animated.View>
      <View style={styles.dots}>
        {STEPS.map((key, index) => (
          <View key={key} style={[styles.dot, index <= step && styles.dotActive]} />
        ))}
      </View>
    </Animated.View>
  );
}

const ORB = 104;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 17, 17, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    zIndex: 10,
  },
  stage: { width: ORB * 2, height: ORB * 2, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: ORB * 1.7,
    height: ORB * 1.7,
    borderRadius: ORB,
    backgroundColor: colors.accent,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { paddingHorizontal: spacing.xxl, minHeight: 56 },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: colors.accent },
});
