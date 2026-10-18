import { type PaidPlan } from '@vyra/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui';
import { type PaywallReason } from './hooks';

/** Discreet link to the paywall, opened with the context that led there. */
export function SeeOffers({ reason, plan }: { reason: PaywallReason; plan?: PaidPlan }) {
  const { t } = useTranslation();
  return (
    <Button
      testID={`see-offers-${reason}`}
      label={t('subscription.seeOffers')}
      variant="ghost"
      size="md"
      fullWidth={false}
      onPress={() =>
        router.push({ pathname: '/paywall', params: { reason, ...(plan ? { plan } : {}) } })
      }
    />
  );
}
