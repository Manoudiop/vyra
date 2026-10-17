import { useQuery } from '@tanstack/react-query';
import { type ClothingItem, type Outfit } from '@vyra/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { GeneratingOverlay } from '@/features/stylist/GeneratingOverlay';
import { outfitKeys, stylistApi } from '@/features/stylist/stylist-api';
import { useGenerateOutfit } from '@/features/stylist/use-generate-outfit';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  ErrorState,
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
  const { t } = useTranslation();
  const { id, exclude } = useLocalSearchParams<{ id: string; exclude?: string }>();
  const outfit = useQuery({
    queryKey: outfitKeys.detail(id),
    queryFn: () => stylistApi.getOutfit(id),
  });
  const another = useGenerateOutfit();

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
      },
      {
        onSuccess: ({ outfit: next }) =>
          router.replace({
            pathname: '/outfit/[id]',
            params: { id: next.id, exclude: seen.join(',') },
          }),
      },
    );
  };

  return (
    <View style={styles.root}>
      <Screen
        testID="outfit-screen"
        footer={
          <View style={styles.footer}>
            {another.isError && (
              <FormBanner tone="error" message={errorMessage(another.error, t)} />
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
        <View style={styles.header}>{back}</View>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.titleBlock}>
          <Text variant="overline" color="secondary">
            {t(`occasions.${data.occasion}`)} · {t(`styles.${data.style}`)}
          </Text>
          <Text variant="title1" accessibilityRole="header" testID="outfit-name">
            {data.name}
          </Text>
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
      </Screen>
      {another.isPending && <GeneratingOverlay />}
    </View>
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
  footer: { gap: spacing.md },
});
