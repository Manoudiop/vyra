import { OCCASIONS, type Occasion } from '@vyra/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Chip, colors, radii, Screen, spacing, Text } from '@/ui';

// Phase 9 wires occasion, style and constraints to POST /api/ai/generate-outfit.

export default function StylistScreen() {
  const { t } = useTranslation();
  const [occasion, setOccasion] = useState<Occasion | null>(null);

  return (
    <Screen testID="stylist-screen">
      <Animated.View entering={FadeInDown.duration(380)}>
        <LinearGradient
          colors={[colors.primary, '#2B2723']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Sparkles size={16} color={colors.primary} strokeWidth={2} />
            <Text variant="caption">AI Stylist</Text>
          </View>
          <Text variant="title1" color="onPrimary" accessibilityRole="header">
            {t('stylist.title')}
          </Text>
          <Text variant="body" style={styles.heroBody}>
            {t('stylist.subtitle')}
          </Text>
        </LinearGradient>
      </Animated.View>

      <View style={styles.chips}>
        {OCCASIONS.map((value) => (
          <Chip
            key={value}
            label={t(`occasions.${value}`)}
            selected={occasion === value}
            onPress={() => setOccasion(value === occasion ? null : value)}
          />
        ))}
      </View>

      <Button label={t('common.comingSoon')} variant="accent" icon={Sparkles} disabled />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 220,
    justifyContent: 'flex-end',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginBottom: 'auto',
  },
  heroBody: { color: 'rgba(255,255,255,0.72)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.xl },
});
