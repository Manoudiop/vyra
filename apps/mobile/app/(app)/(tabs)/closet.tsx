import { FlashList } from '@shopify/flash-list';
import { type ClothingCategory } from '@vyra/shared';
import { router } from 'expo-router';
import { Plus, SearchX, Shirt } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CategoryFilters,
  ClosetGridSkeleton,
  ClothingCard,
  SearchField,
} from '@/features/closet/components';
import { useClosetList, useClosetSummary, useToggleFavorite } from '@/features/closet/hooks';
import { errorMessage } from '@/lib/errors';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { colors, EmptyState, ErrorState, IconButton, ScreenHeader, spacing } from '@/ui';

export default function ClosetScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [favorite, setFavorite] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const filters = useMemo(
    () => ({ search: debouncedSearch, category, favorite }),
    [debouncedSearch, category, favorite],
  );
  const list = useClosetList(filters);
  const summary = useClosetSummary();
  const toggleFavorite = useToggleFavorite();

  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const filtered = Boolean(filters.search.trim() || category || favorite);
  const total = summary.data?.total;

  const resetFilters = () => {
    setSearch('');
    setCategory(null);
    setFavorite(false);
  };

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title={t('closet.title')}
        overline={
          total === undefined
            ? undefined
            : summary.data?.limit
              ? t('closet.countWithLimit', { count: total, limit: summary.data.limit })
              : t('closet.count', { count: total })
        }
        right={
          <IconButton
            icon={Plus}
            accessibilityLabel={t('closet.emptyCta')}
            onPress={() => router.push('/closet/add')}
            testID="closet-add"
          />
        }
      />
      {(total ?? 0) > 0 && (
        <>
          <SearchField value={search} onChange={setSearch} />
          <CategoryFilters
            category={category}
            favorite={favorite}
            counts={summary.data?.byCategory ?? {}}
            total={total}
            favorites={summary.data?.favorites}
            onCategory={setCategory}
            onFavorite={setFavorite}
          />
        </>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (list.isPending) return <ClosetGridSkeleton />;
    if (list.isError) {
      return (
        <ErrorState message={errorMessage(list.error, t)} onRetry={() => void list.refetch()} />
      );
    }
    if (filtered) {
      return (
        <EmptyState
          testID="closet-no-results"
          icon={SearchX}
          title={t('closet.noResultsTitle')}
          body={t('closet.noResultsBody')}
          actionLabel={t('closet.resetFilters')}
          onAction={resetFilters}
        />
      );
    }
    return (
      <EmptyState
        testID="closet-empty"
        icon={Shirt}
        title={t('closet.emptyTitle')}
        body={t('closet.emptyBody')}
        actionLabel={t('closet.emptyCta')}
        onAction={() => router.push('/closet/add')}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID="closet-screen">
      <FlashList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClothingCard
            item={item}
            onPress={() => router.push({ pathname: '/closet/[id]', params: { id: item.id } })}
            onToggleFavorite={() =>
              toggleFavorite.mutate({ id: item.id, isFavorite: !item.isFavorite })
            }
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footerSpinner} />
          ) : null
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => {
              void list.refetch();
              void summary.refetch();
            }}
            tintColor={colors.accent}
          />
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl - (spacing.xs + 2), paddingBottom: spacing.xxxl },
  // Grid cells carry their own 6pt padding; the header re-adds it to align with the 24pt gutter.
  header: { paddingHorizontal: spacing.xs + 2 },
  footerSpinner: { marginVertical: spacing.xl },
});
