import { useQuery } from '@tanstack/react-query';
import {
  type ClothingItem,
  DISLIKE_REASONS,
  type DislikeReason,
  type FeedbackRating,
  type Outfit,
} from '@vyra/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Bookmark,
  CalendarCheck,
  CalendarPlus,
  Check,
  Heart,
  type LucideIcon,
  RefreshCw,
  Shirt,
  Sparkles,
  ThumbsDown,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { useDayFormat, usePlanDay } from '@/features/calendar/hooks';
import { GeneratingOverlay } from '@/features/stylist/GeneratingOverlay';
import { outfitKeys, stylistApi } from '@/features/stylist/stylist-api';
import { useGenerateOutfit } from '@/features/stylist/use-generate-outfit';
import { useOutfitAction } from '@/features/stylist/use-outfit-actions';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  Chip,
  colors,
  colorsAlpha,
  ErrorState,
  haptics,
  IconButton,
  PressableScale,
  radii,
  Screen,
  shadows,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

export default function OutfitScreen() {
  const { t, i18n } = useTranslation();
  const { id, exclude, planFor } = useLocalSearchParams<{
    id: string;
    exclude?: string;
    /** Set when the look was created for a calendar day. */
    planFor?: string;
  }>();
  const format = useDayFormat();
  const planDay = usePlanDay();
  const outfit = useQuery({
    queryKey: outfitKeys.detail(id),
    queryFn: () => stylistApi.getOutfit(id),
  });
  const another = useGenerateOutfit();
  const action = useOutfitAction(id);

  const back = (
    <IconButton
      icon={ArrowLeft}
      accessibilityLabel={t('common.back')}
      onPress={() => goBackOr('/stylist')}
    />
  );

  if (!outfit.data) {
    return (
      <Screen testID="outfit-screen">
        <View style={styles.header}>{back}</View>
        {outfit.isError ? (
          <ErrorState
            message={errorMessage(outfit.error, t)}
            onRetry={() => void outfit.refetch()}
          />
        ) : (
          <View style={styles.loading}>
            <Skeleton height={34} width="70%" />
            <Skeleton height={260} radius={radii.xl} />
            <Skeleton height={120} radius={radii.lg} />
          </View>
        )}
      </Screen>
    );
  }

  const data = outfit.data;
  const tryAnother = () => {
    // Every look seen in this chain stays excluded, so "another" is always new.
    const seen = [...(exclude ? exclude.split(',') : []), data.id];
    another.mutate(
      {
        occasion: data.occasion,
        style: data.style,
        constraints: data.constraints ?? undefined,
        excludeOutfitIds: seen.slice(-20),
        ...(planFor ? { date: planFor } : {}),
      },
      {
        onSuccess: ({ outfit: next }) =>
          router.replace({
            pathname: '/outfit/[id]',
            params: { id: next.id, exclude: seen.join(','), ...(planFor ? { planFor } : {}) },
          }),
      },
    );
  };

  const errorText = action.isError
    ? errorMessage(action.error, t)
    : planDay.isError
      ? errorMessage(planDay.error, t, { LIMIT_REACHED: t('calendar.lockedBody') })
      : another.isError
        ? errorMessage(another.error, t)
        : null;
  const planForLabel = planFor
    ? format(planFor, { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const lastWorn =
    data.lastWornAt && !data.wornToday
      ? new Date(data.lastWornAt).toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'long',
        })
      : null;

  return (
    <View style={styles.root}>
      <Screen
        testID="outfit-screen"
        footer={
          <View style={styles.footer}>
            {errorText && <FormBanner tone="error" message={errorText} />}
            {planFor && planForLabel ? (
              <Button
                testID="outfit-plan-for"
                label={t('calendar.planFor', { date: planForLabel })}
                icon={CalendarCheck}
                loading={planDay.isPending}
                onPress={() =>
                  planDay.mutate(
                    { date: planFor, outfitId: data.id },
                    {
                      onSuccess: () =>
                        router.navigate({ pathname: '/calendar', params: { date: planFor } }),
                    },
                  )
                }
              />
            ) : data.wornToday ? (
              <Animated.View
                entering={FadeIn.duration(260)}
                style={styles.worn}
                testID="outfit-worn"
              >
                <View style={styles.wornIcon}>
                  <Check size={16} color={colors.onPrimary} strokeWidth={3} />
                </View>
                <Text variant="bodyStrong" style={styles.wornLabel}>
                  {t('outfit.wornToday')}
                </Text>
                <Button
                  testID="outfit-unwear"
                  label={t('outfit.undo')}
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  onPress={() => action.mutate({ type: 'wear', worn: false })}
                />
              </Animated.View>
            ) : (
              <Button
                testID="outfit-wear"
                label={t('outfit.wearToday')}
                icon={Shirt}
                onPress={() => {
                  haptics.success();
                  action.mutate({ type: 'wear', worn: true });
                }}
              />
            )}
            <Button
              testID="outfit-another"
              label={t('outfit.tryAnother')}
              icon={RefreshCw}
              variant="secondary"
              onPress={tryAnother}
              loading={another.isPending}
            />
          </View>
        }
      >
        <View style={[styles.header, styles.headerRow]}>
          {back}
          <View style={styles.headerActions}>
            <IconButton
              testID="outfit-plan"
              icon={CalendarPlus}
              accessibilityLabel={t('calendar.planThisLook')}
              onPress={() =>
                router.push({ pathname: '/plan-outfit/[id]', params: { id: data.id } })
              }
            />
            <IconButton
              testID="outfit-save"
              icon={Bookmark}
              selected={data.isSaved}
              accessibilityLabel={data.isSaved ? t('outfit.unsave') : t('outfit.save')}
              onPress={() => action.mutate({ type: 'save', isSaved: !data.isSaved })}
            />
          </View>
        </View>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.titleBlock}>
          <Text variant="overline" color="secondary">
            {t(`occasions.${data.occasion}`)} · {t(`styles.${data.style}`)}
          </Text>
          <Text variant="title1" accessibilityRole="header" testID="outfit-name">
            {data.name}
          </Text>
          {lastWorn && (
            <Text variant="footnote" color="secondary" testID="outfit-last-worn">
              {t('outfit.lastWorn', { date: lastWorn })}
            </Text>
          )}
        </Animated.View>

        <OutfitBoard items={data.items} />

        <Animated.View entering={FadeInUp.delay(250).duration(420)}>
          <Card style={styles.why}>
            <View style={styles.whyTitle}>
              <View style={styles.whyIcon}>
                <Sparkles size={16} color={colors.accent} />
              </View>
              <Text variant="bodyStrong">{t('outfit.why')}</Text>
            </View>
            <Text variant="body" color="secondary" testID="outfit-reason">
              {data.reason}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(420)}>
          <RatingCard
            feedback={data.feedback}
            onRate={(rating, reason) =>
              action.mutate({
                type: 'rate',
                feedback: rating ? { rating, ...(reason ? { reason } : {}) } : null,
              })
            }
          />
        </Animated.View>
      </Screen>
      {another.isPending && <GeneratingOverlay />}
    </View>
  );
}

/**
 * "Love it" / "Not for me". Tapping the active choice again clears it; after
 * "not for me" an optional one-tap reason helps the stylist learn.
 */
function RatingCard({
  feedback,
  onRate,
}: {
  feedback: Outfit['feedback'];
  onRate: (rating: FeedbackRating | null, reason?: DislikeReason) => void;
}) {
  const { t } = useTranslation();
  const rating = feedback?.rating ?? null;
  return (
    <Card style={styles.rating} testID="outfit-rating">
      <Text variant="bodyStrong">{t('outfit.rateTitle')}</Text>
      <View style={styles.rateRow}>
        <RateButton
          testID="outfit-love"
          icon={Heart}
          label={t('outfit.love')}
          selected={rating === 'LOVE'}
          tone="accent"
          onPress={() => onRate(rating === 'LOVE' ? null : 'LOVE')}
        />
        <RateButton
          testID="outfit-dislike"
          icon={ThumbsDown}
          label={t('outfit.dislike')}
          selected={rating === 'DISLIKE'}
          tone="primary"
          onPress={() => onRate(rating === 'DISLIKE' ? null : 'DISLIKE')}
        />
      </View>
      {rating === 'LOVE' && (
        <Animated.View entering={FadeIn.duration(260)}>
          <Text variant="footnote" color="secondary" testID="outfit-loved-hint">
            {t('outfit.lovedHint')}
          </Text>
        </Animated.View>
      )}
      {rating === 'DISLIKE' && (
        <Animated.View entering={FadeIn.duration(260)} style={styles.reasons}>
          <Text variant="footnote" color="secondary" testID="outfit-disliked-hint">
            {t('outfit.dislikedHint')}
          </Text>
          <View style={styles.reasonChips}>
            {DISLIKE_REASONS.map((reason) => (
              <Chip
                key={reason}
                testID={`reason-${reason}`}
                label={t(`dislikeReasons.${reason}`)}
                selected={feedback?.reason === reason}
                onPress={() => onRate('DISLIKE', feedback?.reason === reason ? undefined : reason)}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </Card>
  );
}

function RateButton({
  icon: Icon,
  label,
  selected,
  tone,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  tone: 'accent' | 'primary';
  onPress: () => void;
  testID: string;
}) {
  const fg = selected ? colors.onPrimary : colors.primary;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.rateButton,
        selected && { backgroundColor: colors[tone], borderColor: colors[tone] },
      ]}
    >
      <Icon size={18} color={fg} fill={selected ? fg : 'none'} strokeWidth={2} />
      <Text variant="bodyStrong" style={{ color: fg }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** The look laid out like a flat-lay: real photos of the user's own pieces. */
function OutfitBoard({ items }: { items: Outfit['items'] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.board} accessibilityLabel={t('outfit.pieces')}>
      {items.map((item, index) => (
        <Animated.View
          key={item.id}
          entering={FadeInDown.delay(80 * index).duration(380)}
          style={[styles.tileSlot, items.length % 2 === 1 && index === 0 && styles.tileWide]}
        >
          <PieceTile item={item} wide={items.length % 2 === 1 && index === 0} />
        </Animated.View>
      ))}
    </View>
  );
}

function PieceTile({ item, wide }: { item: ClothingItem; wide: boolean }) {
  const { t } = useTranslation();
  return (
    <PressableScale
      testID={`outfit-piece-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${t(`categories.${item.category}`)}`}
      onPress={() => router.push({ pathname: '/closet/[id]', params: { id: item.id } })}
      style={styles.tile}
    >
      <Image
        source={{ uri: wide ? item.imageUrl : item.thumbnailUrl }}
        // The wide tile is landscape: show the whole garment instead of cropping it.
        contentFit={wide ? 'contain' : 'cover'}
        transition={200}
        style={[styles.tileImage, wide && styles.tileImageWide]}
      />
      <View style={styles.tileCopy}>
        <Text variant="footnote" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {t(`categories.${item.category}`)}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  loading: { gap: spacing.lg },
  titleBlock: { gap: spacing.xs, marginBottom: spacing.xl },
  board: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  tileSlot: { width: '50%', padding: spacing.xs },
  tileWide: { width: '100%' },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  tileImage: { aspectRatio: 4 / 5, backgroundColor: colors.muted },
  tileImageWide: { aspectRatio: 16 / 11, backgroundColor: '#F1EEE8' },
  tileCopy: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  why: { gap: spacing.md, marginTop: spacing.xl },
  whyTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  whyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rating: { gap: spacing.md, marginTop: spacing.lg },
  rateRow: { flexDirection: 'row', gap: spacing.sm },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasons: { gap: spacing.md },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  worn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingLeft: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colorsAlpha.successSoft,
  },
  wornIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wornLabel: { flex: 1 },
  footer: { gap: spacing.md },
});
