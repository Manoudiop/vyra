import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { type Outfit } from '@vyra/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Bookmark } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { outfitKeys, stylistApi } from '@/features/stylist/stylist-api';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  colors,
  EmptyState,
  ErrorState,
  IconButton,
  PressableScale,
  radii,
  ScreenHeader,
  shadows,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

export default function SavedOutfitsScreen() {
  const { t } = useTranslation();
  const saved = useInfiniteQuery({
    queryKey: outfitKeys.saved(),
    queryFn: ({ pageParam }) => stylistApi.listSaved(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const outfits = saved.data?.pages.flatMap((page) => page.items) ?? [];

  const renderEmpty = () => {
    if (saved.isPending) {
      return (
        <View style={styles.loading}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={112} radius={radii.lg} />
          ))}
        </View>
      );
    }
    if (saved.isError) {
      return (
        <ErrorState message={errorMessage(saved.error, t)} onRetry={() => void saved.refetch()} />
      );
    }
    return (
      <EmptyState
        testID="saved-empty"
        icon={Bookmark}
        title={t('savedOutfits.emptyTitle')}
        body={t('savedOutfits.emptyBody')}
        actionLabel={t('savedOutfits.emptyCta')}
        onAction={() => router.navigate('/stylist')}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID="saved-outfits-screen">
      <FlashList
        data={outfits}
        keyExtractor={(outfit) => outfit.id}
        renderItem={({ item }) => <SavedOutfitRow outfit={item} />}
        ListHeaderComponent={
          <View>
            <View style={styles.back}>
              <IconButton
                icon={ArrowLeft}
                accessibilityLabel={t('common.back')}
                onPress={() => goBackOr('/profile')}
              />
            </View>
            <ScreenHeader title={t('savedOutfits.title')} subtitle={t('savedOutfits.subtitle')} />
          </View>
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          saved.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : null
        }
        onEndReached={() => {
          if (saved.hasNextPage && !saved.isFetchingNextPage) void saved.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={saved.isRefetching && !saved.isFetchingNextPage}
            onRefresh={() => void saved.refetch()}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

function SavedOutfitRow({ outfit }: { outfit: Outfit }) {
  const { t } = useTranslation();
  const pieces = outfit.items.slice(0, 4);
  return (
    <PressableScale
      testID={`saved-outfit-${outfit.id}`}
      accessibilityRole="button"
      accessibilityLabel={outfit.name}
      onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })}
      style={styles.row}
    >
      <View style={styles.mosaic}>
        {pieces.map((piece) => (
          <Image
            key={piece.id}
            source={{ uri: piece.thumbnailUrl }}
            contentFit="cover"
            recyclingKey={piece.id}
            style={[styles.mosaicTile, pieces.length < 3 && styles.mosaicTileTall]}
          />
        ))}
      </View>
      <View style={styles.copy}>
        <Text variant="overline" color="secondary" numberOfLines={1}>
          {t(`occasions.${outfit.occasion}`)} · {t(`styles.${outfit.style}`)}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {outfit.name}
        </Text>
        <Text variant="footnote" color="secondary">
          {t('savedOutfits.pieces', { count: outfit.items.length })}
        </Text>
      </View>
    </PressableScale>
  );
}

const MOSAIC = 96;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { paddingTop: spacing.md },
  loading: { gap: spacing.md },
  spinner: { marginVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  mosaic: {
    width: MOSAIC,
    height: MOSAIC,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  mosaicTile: {
    width: (MOSAIC - 2) / 2,
    height: (MOSAIC - 2) / 2,
    backgroundColor: colors.muted,
  },
  mosaicTileTall: { height: MOSAIC },
  copy: { flex: 1, gap: spacing.xs },
});
