import { formatXof, PLAN_DEFINITIONS } from '@vyra/shared';
import { router } from 'expo-router';
import { ArrowLeft, Crown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import {
  useCancelSubscription,
  useResumeSubscription,
  useSubscription,
} from '@/features/subscriptions/hooks';
import { PlanUsageCard } from '@/features/usage/UsageViews';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  ErrorState,
  IconButton,
  radii,
  Screen,
  ScreenHeader,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

/** Manage the subscription: what you have, until when, change or cancel in two taps. */
export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation();
  const subscription = useSubscription();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [confirming, setConfirming] = useState(false);
  const data = subscription.data;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const error = cancel.error ?? resume.error;

  return (
    <Screen testID="subscription-screen">
      <View style={styles.back}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('common.back')}
          onPress={() => goBackOr('/profile')}
        />
      </View>
      <ScreenHeader title={t('subscription.title')} />

      {!data ? (
        subscription.isError ? (
          <ErrorState
            message={errorMessage(subscription.error, t)}
            onRetry={() => void subscription.refetch()}
          />
        ) : (
          <Skeleton height={160} radius={radii.lg} />
        )
      ) : (
        <View style={styles.content}>
          <Card style={styles.current} testID="subscription-current">
            <View style={styles.row}>
              <View style={styles.iconBubble}>
                <Crown size={18} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <Text variant="title3" testID="subscription-plan">
                  {t(`plans.${data.plan}`)}
                </Text>
                <Text variant="footnote" color="secondary">
                  {data.plan === 'FREE'
                    ? t('subscription.freeLine')
                    : t('subscription.priceLine', {
                        price: formatXof(PLAN_DEFINITIONS[data.plan].monthlyPriceXof),
                      })}
                </Text>
              </View>
            </View>
            {data.plan !== 'FREE' && data.currentPeriodEnd && (
              <Text variant="body" testID="subscription-status">
                {data.cancelAtPeriodEnd
                  ? t('subscription.endsOn', {
                      plan: t(`plans.${data.plan}`),
                      date: formatDate(data.currentPeriodEnd),
                    })
                  : t('subscription.renewsOn', { date: formatDate(data.currentPeriodEnd) })}
              </Text>
            )}
          </Card>

          {error && <FormBanner tone="error" message={errorMessage(error, t)} />}

          {data.plan === 'FREE' ? (
            <Button
              testID="subscription-discover"
              label={t('subscription.discover')}
              icon={Crown}
              variant="accent"
              onPress={() => router.push('/paywall')}
            />
          ) : data.cancelAtPeriodEnd ? (
            <Button
              testID="subscription-resume"
              label={t('subscription.resume', { plan: t(`plans.${data.plan}`) })}
              loading={resume.isPending}
              onPress={() => resume.mutate()}
            />
          ) : (
            <>
              <Button
                testID="subscription-change"
                label={t('subscription.change')}
                variant="secondary"
                onPress={() => router.push('/paywall')}
              />
              {confirming ? (
                <Animated.View entering={FadeIn.duration(220)}>
                  <Card style={styles.confirm} testID="subscription-cancel-confirm">
                    <Text variant="bodyStrong">{t('subscription.cancelTitle')}</Text>
                    <Text variant="body" color="secondary">
                      {t('subscription.cancelExplain', {
                        plan: t(`plans.${data.plan}`),
                        date: data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : '',
                      })}
                    </Text>
                    <View style={styles.confirmActions}>
                      <Button
                        testID="subscription-cancel-keep"
                        label={t('subscription.keep')}
                        variant="secondary"
                        size="md"
                        style={styles.flex}
                        onPress={() => setConfirming(false)}
                      />
                      <Button
                        testID="subscription-cancel-confirm-button"
                        label={t('subscription.confirmCancel')}
                        variant="secondary"
                        size="md"
                        style={styles.flex}
                        loading={cancel.isPending}
                        onPress={() =>
                          cancel.mutate(undefined, { onSuccess: () => setConfirming(false) })
                        }
                      />
                    </View>
                  </Card>
                </Animated.View>
              ) : (
                <Button
                  testID="subscription-cancel"
                  label={t('subscription.cancel')}
                  variant="ghost"
                  onPress={() => setConfirming(true)}
                />
              )}
            </>
          )}

          <PlanUsageCard />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.md },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  current: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { gap: spacing.md },
  confirmActions: { flexDirection: 'row', gap: spacing.sm },
});
