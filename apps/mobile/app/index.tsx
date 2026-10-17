import { colors, fontFamily, fontSize, spacing } from '@vyra/config/tokens';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiStatus } from '@/features/health/api-status';

// Phase 1 placeholder: proves fonts, tokens, shared packages and API wiring.
// Replaced by the onboarding / auth flow in phases 4–5.
export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <Text style={styles.wordmark} accessibilityRole="header">
          VYRA
        </Text>
        <Text style={styles.tagline}>Ton dressing. Ton style. Ton IA.</Text>
      </View>
      <ApiStatus />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  wordmark: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    letterSpacing: 10,
    color: colors.primary,
  },
  tagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.callout,
    color: colors.secondary,
  },
});
