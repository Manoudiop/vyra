import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CloudSun, Shirt, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Button, colors, radii, Screen, shadows, spacing, Text } from '@/ui';

/** Swatches of a sample look: cream shirt, camel trousers, cognac loafers. */
const SAMPLE_LOOK = ['#F1EADB', '#B98B5E', '#8A4F2A'] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      scroll={false}
      edges={['top', 'bottom']}
      testID="welcome-screen"
      footer={
        <Animated.View entering={FadeInUp.delay(300).duration(420)} style={styles.actions}>
          <Button
            label={t('auth.welcome.createAccount')}
            onPress={() => router.push('/register')}
          />
          <Button
            label={t('auth.welcome.signIn')}
            variant="secondary"
            onPress={() => router.push('/login')}
          />
        </Animated.View>
      }
    >
      <View style={styles.brandRow}>
        <Text variant="title3" style={styles.wordmark}>
          {t('common.appName')}
        </Text>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={styles.stage}>
        <View style={[styles.floating, styles.floatLeft]}>
          <Shirt size={20} color={colors.primary} strokeWidth={1.75} />
        </View>
        <View style={[styles.floating, styles.floatRight]}>
          <CloudSun size={20} color={colors.primary} strokeWidth={1.75} />
          <Text variant="caption">28°</Text>
        </View>

        <View style={styles.lookCard}>
          <LinearGradient colors={['#FFFFFF', '#F3F0EA']} style={styles.lookCanvas}>
            {SAMPLE_LOOK.map((swatch, index) => (
              <View
                key={swatch}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch, height: index === 1 ? 92 : 64 },
                  index === 2 && styles.swatchShoe,
                ]}
              />
            ))}
          </LinearGradient>
          <View style={styles.lookMeta}>
            <View style={styles.aiBadge}>
              <Sparkles size={14} color={colors.onPrimary} strokeWidth={2} />
            </View>
            <View style={styles.lookCopy}>
              <Text variant="bodyStrong">{t('auth.welcome.sampleLook')}</Text>
              <Text variant="caption" color="secondary">
                {t('auth.welcome.sampleLookCaption')}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.copy}>
        <Text variant="display">{t('auth.welcome.title')}</Text>
        <Text variant="callout" color="secondary">
          {t('auth.welcome.subtitle')}
        </Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { paddingTop: spacing.lg, alignItems: 'center' },
  wordmark: { letterSpacing: 8 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  lookCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    transform: [{ rotate: '-3deg' }],
    ...shadows.floating,
  },
  lookCanvas: {
    height: 220,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  swatch: { width: 96, borderRadius: radii.md },
  swatchShoe: { width: 70, height: 26, borderRadius: radii.pill },
  lookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  lookCopy: { flex: 1 },
  aiBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 44,
    minWidth: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    zIndex: 1,
    ...shadows.card,
  },
  floatLeft: { left: '8%', top: '22%' },
  floatRight: { right: '8%', bottom: '24%' },
  copy: { gap: spacing.md, paddingBottom: spacing.lg },
  actions: { gap: spacing.md },
});
