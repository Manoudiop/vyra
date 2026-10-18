import { type PlanFeature, type PlanOffer } from '@vyra/shared';
import { type TFunction } from 'i18next';

/**
 * Features shipped in the app. EVENT_STYLING and SHOPPING_RECOMMENDATIONS
 * exist in the plan definitions but not yet in the product: they are not
 * advertised until they are.
 */
const SHIPPED_FEATURES = [
  'WEATHER',
  'CALENDAR_FULL',
  'STYLE_ANALYSIS',
] as const satisfies readonly PlanFeature[];

/** What a plan gives, in plain words, from its definition (no hand-written marketing). */
export function offerHighlights(offer: PlanOffer, t: TFunction): string[] {
  const lines: string[] = [];
  for (const { metric, limit, period } of offer.metered) {
    lines.push(
      limit === null
        ? t(`subscription.highlights.${metric}_unlimited`)
        : t(`subscription.highlights.${metric}`, {
            count: limit,
            period: t(`usage.per.${period}`),
          }),
    );
  }
  lines.push(
    offer.maxClothingItems === null
      ? t('subscription.highlights.closetUnlimited')
      : t('subscription.highlights.closet', { count: offer.maxClothingItems }),
  );
  for (const feature of SHIPPED_FEATURES) {
    if (offer.features.includes(feature)) lines.push(t(`subscription.features.${feature}`));
  }
  if (!offer.features.includes('CALENDAR_FULL'))
    lines.push(t('subscription.highlights.calendarWeek'));
  return lines;
}
