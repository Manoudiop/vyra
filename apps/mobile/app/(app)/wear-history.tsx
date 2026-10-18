import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, History, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calendarApi, calendarKeys } from '@/features/calendar/calendar-api';
import { useDayFormat } from '@/features/calendar/hooks';
import { OutfitRow } from '@/features/calendar/OutfitRow';
import { SeeOffers } from '@/features/subscriptions/SeeOffers';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Card,
  colors,
  colorsAlpha,
  EmptyState,
  ErrorState,
  IconButton,
  radii,
  ScreenHeader,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

export default function WearHistoryScreen() {
  const { t } = useTranslation();
  const format = useDayFormat();
  const history = useInfiniteQuery({
    queryKey: calendarKeys.history(),
    queryFn: ({ pageParam }) => calendarApi.wearHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const entries = history.data?.pages.flatMap((page) => page.items) ?? [];
  const visibleFrom = history.data?.pages[0]?.visibleFrom ?? null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID="wear-history-screen">
      <FlashList
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item, index }) => {
          // One date label per day.
          const showDate = index === 0 || entries[index - 1]?.date !== item.date;
          const label = format(item.date, { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <View style={styles.entry}>
              {showDate && (
                <Text variant="overline" color="secondary" style={styles.date}>
                  {label}
                </Text>
              )}
              <Card>
                <OutfitRow outfit={item.outfit} worn />
              </Card>
            </View>
          );
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.back}>
              <IconButton
                icon={ArrowLeft}
                accessibilityLabel={t('common.back')}
                onPress={() => goBackOr('/calendar')}
              />
            </View>
            <ScreenHeader title={t('wearHistory.title')} subtitle={t('wearHistory.subtitle')} />
          </View>
        }
        ListEmptyComponent={
          history.isPending ? (
            <View style={styles.loading}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} height={88} radius={radii.lg} />
              ))}
            </View>
          ) : history.isError ? (
            <ErrorState
              message={errorMessage(history.error, t)}
              onRetry={() => void history.refetch()}
            />
          ) : (
            <EmptyState
              testID="history-empty"
              icon={History}
              title={t('wearHistory.emptyTitle')}
              body={t('wearHistory.emptyBody')}
              actionLabel={t('wearHistory.emptyCta')}
              onAction={() => router.navigate('/stylist')}
            />
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : visibleFrom && !history.isPending ? (
            <Card style={styles.limited} testID="history-limited">
              <View style={styles.lockIcon}>
                <Lock size={16} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <Text variant="footnote" color="secondary">
                  {t('wearHistory.limited')}
                </Text>
                <View style={styles.offers}>
                  <SeeOffers reason="history" />
                </View>
              </View>
            </Card>
          ) : null
        }
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => void history.refetch()}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { paddingTop: spacing.md },
  loading: { gap: spacing.md },
  entry: { paddingBottom: spacing.md },
  date: { marginBottom: spacing.sm, marginTop: spacing.sm },
  spinner: { marginVertical: spacing.lg },
  limited: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  offers: { alignItems: 'flex-start', marginLeft: -spacing.md },
});
