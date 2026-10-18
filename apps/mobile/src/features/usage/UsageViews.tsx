import { PLAN_DEFINITIONS, type UsageLimitDetails, type UsageMeter } from '@vyra/shared';
import { Crown, Hourglass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card, colors, colorsAlpha, radii, Skeleton, spacing, Text } from '@/ui';
import { useResetDate, useUsage } from './use-usage';

/**
 * Shown when the plan's generations are used up: what happened, when it
 * comes back, and what the next plan offers. No countdown, no pressure.
 */
export function GenerationsUsedUp({ details }: { details: UsageLimitDetails }) {
  const { t } = useTranslation();
  const resetDate = useResetDate();
  const next = details.suggestedPlan
    ? PLAN_DEFINITIONS[details.suggestedPlan].metered.OUTFIT_GENERATION
    : null;
  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <Card style={styles.usedUp} testID="generations-used-up">
        <View style={styles.iconBubble}>
          <Hourglass size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {t('usage.generationsUsedUp', {
              count: details.limit,
              period: t(`usage.periodOf.${details.period}`),
            })}
          </Text>
          <Text variant="footnote" color="secondary">
            {t('usage.newLooksOn', { date: resetDate(details.resetsAt) })}
          </Text>
          {details.suggestedPlan && next?.limit && (
            <Text variant="footnote" color="secondary" testID="usage-upgrade-hint">
              {t('usage.upgradeHint', {
                plan: t(`plans.${details.suggestedPlan}`),
                count: next.limit,
                period: t(`usage.per.${next.period}`),
              })}
            </Text>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

/** "2 looks restants cette semaine" under the generate button (limited plans only). */
export function GenerationsLeft({ meter }: { meter: UsageMeter }) {
  const { t } = useTranslation();
  if (meter.remaining === null) return null;
  return (
    <Text variant="caption" color="secondary" style={styles.center} testID="generations-left">
      {t('usage.looksLeft', {
        count: meter.remaining,
        period: t(`usage.period.${meter.period}`),
      })}
    </Text>
  );
}

/** Profile card: the plan and each meter of the current period. */
export function PlanUsageCard() {
  const { t } = useTranslation();
  const usage = useUsage();
  const resetDate = useResetDate();
  if (!usage.data) return <Skeleton height={150} radius={radii.lg} />;
  return (
    <Card style={styles.plan} testID="plan-usage">
      <View style={styles.planHeader}>
        <View style={styles.iconBubble}>
          <Crown size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="caption" color="secondary">
            {t('usage.yourPlan')}
          </Text>
          <Text variant="title3" testID="plan-name">
            {t(`plans.${usage.data.plan}`)}
          </Text>
        </View>
      </View>
      {usage.data.meters.map((meter) => (
        <View key={meter.metric} style={styles.meter} testID={`meter-${meter.metric}`}>
          <View style={styles.meterRow}>
            <Text variant="callout" style={styles.flex}>
              {t(`usage.metrics.${meter.metric}`)}
            </Text>
            <Text variant="callout" color="secondary">
              {meter.limit === null
                ? t('usage.unlimited', { used: meter.used })
                : t('usage.usedOf', {
                    used: meter.used,
                    limit: meter.limit,
                    period: t(`usage.per.${meter.period}`),
                  })}
            </Text>
          </View>
          {meter.limit !== null && (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  meter.remaining === 0 && styles.fillFull,
                  { width: `${Math.min(100, (meter.used / meter.limit) * 100)}%` },
                ]}
              />
            </View>
          )}
          <Text variant="caption" color="secondary">
            {t('usage.resetsOn', { date: resetDate(meter.resetsAt) })}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usedUp: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  plan: { gap: spacing.lg },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meter: { gap: spacing.xs },
  meterRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  fillFull: { backgroundColor: colors.primary },
});
