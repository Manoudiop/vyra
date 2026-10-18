import { formatXof, type PaidPlan, type PlanOffer } from '@vyra/shared';
import { useLocalSearchParams } from 'expo-router';
import { Check, CircleCheck, Info, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormBanner } from '@/features/auth/components';
import {
  type PaywallReason,
  useCheckout,
  usePlans,
  useSubscription,
} from '@/features/subscriptions/hooks';
import { offerHighlights } from '@/features/subscriptions/offer-highlights';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  IconButton,
  PressableScale,
  radii,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

const REASONS: PaywallReason[] = [
  'generations',
  'analyses',
  'calendar',
  'history',
  'style',
  'closet',
];

/**
 * The paywall, without dark patterns: close is visible from the first frame,
 * the monthly price is stated plainly, there is no countdown or fake scarcity,
 * and a confirmation step repeats exactly what will be charged and how to
 * cancel. In the MVP the payment is simulated, and the screen says so.
 */
export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ reason?: string; plan?: string }>();
  const reason = REASONS.find((value) => value === params.reason) ?? null;
  const plans = usePlans();
  const subscription = useSubscription();
  const checkout = useCheckout();
  const current = subscription.data?.plan ?? 'FREE';
  const paid = (plans.data ?? []).filter(
    (offer): offer is PlanOffer & { plan: PaidPlan } => offer.plan !== 'FREE',
  );
  const defaultPlan: PaidPlan =
    params.plan === 'PREMIUM' || current === 'PRO' || reason === 'style' ? 'PREMIUM' : 'PRO';
  // Follows the subscription until the user picks a plan themself.
  const [picked, setSelected] = useState<PaidPlan | null>(null);
  const selected = picked ?? defaultPlan;
  const [step, setStep] = useState<'choose' | 'confirm' | 'done'>('choose');
  // What was actually bought: the subscription changes right after, and with it the default pick.
  const [purchased, setPurchased] = useState<PaidPlan | null>(null);
  const purchasedOffer = paid.find((entry) => entry.plan === purchased);
  const offer = paid.find((entry) => entry.plan === selected);
  const close = () => goBackOr('/profile');

  // A subscription started now renews in a month.
  const [renewalLabel] = useState(() => {
    const renewal = new Date();
    renewal.setMonth(renewal.getMonth() + 1);
    return renewal.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' });
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="paywall-screen">
      <View style={styles.topBar}>
        <IconButton
          testID="paywall-close"
          icon={X}
          accessibilityLabel={t('common.close')}
          onPress={close}
        />
      </View>

      {step === 'done' && purchasedOffer ? (
        <Animated.View entering={FadeIn.duration(320)} style={styles.done} testID="paywall-done">
          <View style={styles.doneIcon}>
            <CircleCheck size={40} color={colors.success} />
          </View>
          <Text variant="title1" style={styles.center}>
            {t('subscription.welcome', { plan: t(`plans.${purchasedOffer.plan}`) })}
          </Text>
          <View style={styles.highlights}>
            {offerHighlights(purchasedOffer, t).map((line) => (
              <View key={line} style={styles.highlight}>
                <Check size={16} color={colors.success} />
                <Text variant="body" style={styles.flex}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
          <Button testID="paywall-finish" label={t('subscription.letsGo')} onPress={close} />
        </Animated.View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Animated.View entering={FadeInDown.duration(320)} style={styles.header}>
              <Text variant="overline" color="secondary">
                VYRA
              </Text>
              <Text variant="title1" accessibilityRole="header">
                {t('subscription.paywallTitle')}
              </Text>
              {reason && (
                <Text variant="body" color="secondary" testID="paywall-reason">
                  {t(`subscription.reasons.${reason}`)}
                </Text>
              )}
            </Animated.View>

            {plans.isPending ? (
              <View style={styles.plans}>
                <Skeleton height={220} radius={radii.lg} />
                <Skeleton height={220} radius={radii.lg} />
              </View>
            ) : step === 'choose' ? (
              <View style={styles.plans} accessibilityRole="radiogroup">
                {paid.map((entry) => (
                  <PlanCard
                    key={entry.plan}
                    offer={entry}
                    selected={selected === entry.plan}
                    isCurrent={current === entry.plan && !subscription.data?.cancelAtPeriodEnd}
                    onSelect={() => setSelected(entry.plan)}
                  />
                ))}
              </View>
            ) : (
              offer && (
                <Card style={styles.confirm} testID="paywall-confirm">
                  <Text variant="title3">{t('subscription.confirmTitle')}</Text>
                  <Text variant="body" testID="paywall-confirm-summary">
                    {t('subscription.confirmSummary', {
                      plan: t(`plans.${offer.plan}`),
                      price: formatXof(offer.monthlyPriceXof),
                      date: renewalLabel,
                    })}
                  </Text>
                  <Text variant="footnote" color="secondary">
                    {t('subscription.cancelAnytime')}
                  </Text>
                </Card>
              )
            )}

            <View style={styles.reassurance}>
              <Text variant="footnote" color="secondary">
                {t('subscription.noCommitment')}
              </Text>
            </View>
            {subscription.data?.provider === 'mock' && (
              <View style={styles.demo} testID="paywall-demo-notice">
                <Info size={16} color={colors.secondary} />
                <Text variant="footnote" color="secondary" style={styles.flex}>
                  {t('subscription.demoNotice')}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {checkout.isError && (
              <FormBanner tone="error" message={errorMessage(checkout.error, t)} />
            )}
            {offer && step === 'choose' && (
              <Button
                testID="paywall-continue"
                label={t('subscription.continueWith', {
                  plan: t(`plans.${offer.plan}`),
                  price: formatXof(offer.monthlyPriceXof),
                })}
                disabled={current === offer.plan && !subscription.data?.cancelAtPeriodEnd}
                onPress={() => setStep('confirm')}
              />
            )}
            {offer && step === 'confirm' && (
              <>
                <Button
                  testID="paywall-pay"
                  label={t('subscription.confirmAndPay', {
                    price: formatXof(offer.monthlyPriceXof),
                  })}
                  loading={checkout.isPending}
                  onPress={() =>
                    checkout.mutate(offer.plan, {
                      onSuccess: (result) => {
                        if (result.status !== 'COMPLETED') return;
                        setPurchased(offer.plan);
                        setStep('done');
                      },
                    })
                  }
                />
                <Button
                  testID="paywall-back"
                  label={t('common.back')}
                  variant="ghost"
                  onPress={() => setStep('choose')}
                />
              </>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function PlanCard({
  offer,
  selected,
  isCurrent,
  onSelect,
}: {
  offer: PlanOffer;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PressableScale
      testID={`paywall-plan-${offer.plan}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${t(`plans.${offer.plan}`)}, ${formatXof(offer.monthlyPriceXof)} ${t('subscription.perMonth')}`}
      onPress={onSelect}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <View style={styles.planHeader}>
        <View style={styles.flex}>
          <Text variant="title3">{t(`plans.${offer.plan}`)}</Text>
          {isCurrent && (
            <Text variant="caption" color="secondary">
              {t('subscription.currentPlan')}
            </Text>
          )}
        </View>
        <View style={styles.price}>
          <Text variant="title3">{formatXof(offer.monthlyPriceXof)}</Text>
          <Text variant="caption" color="secondary">
            {t('subscription.perMonth')}
          </Text>
        </View>
      </View>
      <View style={styles.highlights}>
        {offerHighlights(offer, t).map((line) => (
          <View key={line} style={styles.highlight}>
            <Check size={16} color={selected ? colors.accent : colors.secondary} />
            <Text variant="footnote" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.sm },
  plans: { gap: spacing.md },
  plan: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: colorsAlpha.accentSoft },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  price: { alignItems: 'flex-end' },
  highlights: { gap: spacing.sm },
  highlight: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  confirm: { gap: spacing.md },
  reassurance: { gap: spacing.xs },
  demo: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  done: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.xl, justifyContent: 'center' },
  doneIcon: { alignSelf: 'center' },
});
